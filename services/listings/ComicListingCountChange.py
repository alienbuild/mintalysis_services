

# TODO: create a json field in veve_imx_status table to store the listing data
# TODO Check for price changes and update the existing listing if the listing id is the same
import logging
import traceback
import winsound
import httpx
import asyncio
import json
import backoff
import requests
import time
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

load_dotenv()

# Set a higher timeout value (e.g., 30 seconds)
timeout = httpx.Timeout(30.0)

db_config = {
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'database': os.getenv('DB_NAME'),
}

db_connection = mysql.connector.connect(**db_config)
cursor = db_connection.cursor()

async def get_db_connection():
    return mysql.connector.connect(**db_config)

url = "https://web.api.prod.veve.me/graphql"
headers = {
    "Content-Type": "application/json",
    "User-Agent": "alice-requests",
    "client-name": "alice-backend",
    "accept": "application/json",
    "cookie": os.getenv('ALICE_COOKIE'),
    "csrf-token": os.getenv('ALICE_CSRF_TOKEN'),
    "client-version": "...",
    "X-Auth-Version": "2"
}

# def get_comic_ids():
#     cursor.execute("SELECT comic_image_url_id FROM veve_comics ORDER BY drop_date DESC")
#     return cursor.fetchall()

async def fetch_listing_counts(retries=3, delay=5):
    query = """
    query marketListingByComicCover {
        marketListingByComicCover {
            edges {
                node {
                  id
                  totalMarketListings
                  minMarketPrice
                  maxMarketPrice
                  floorMarketPrice
                  fixedListingCount
                  auctionListingCount
                  minComicIssueNumber
                }
            }
        }
    }
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(retries):
            try:
                response = await client.post(url, json={"query": query}, headers=headers)
                if response.status_code == 502:
                    print(f"502 Bad Gateway received - Attempt {attempt + 1} of {retries}")
                    await asyncio.sleep(delay)
                    continue
                # Checking for a successful HTTP status code
                response.raise_for_status()

                # Additional check for the 'application/json' Content-Type
                if "application/json" in response.headers["Content-Type"]:
                    try:
                        data = response.json()
                        if "errors" in data:
                            print(f"GraphQL error: {data['errors']} - Attempt {attempt + 1} of {retries}")
                        else:
                            return data
                    except httpx.JSONDecodeError:
                        print(f"Failed to decode JSON - Attempt {attempt + 1} of {retries}")
                else:
                    print(f"Unexpected Content-Type - Attempt {attempt + 1} of {retries}")

            except httpx.HTTPStatusError as e:
                print(f"HTTP error: {e} - Attempt {attempt + 1} of {retries}")
            except httpx.ReadTimeout:
                print("Request timed out")
            except Exception as e:
                print(f"An unexpected error occurred: {e}")

            # Wait before retrying
            if attempt < retries - 1:
                await asyncio.sleep(delay)

        return None

def transform_response(response):
    data_dict = {}
    # print(response)
    for edge in response["data"]["marketListingByComicCover"]["edges"]:
        node = edge["node"]
        # Use the 'id' as the key and the rest of the node as the value
        data_dict[node["id"]] = node
    return data_dict

def compare_data(initial_data, updated_data):
    changed_ids = []
    for comic_id, initial_values in initial_data.items():
        if comic_id not in updated_data:
            continue  # Skip if the comic_id is not found in the updated data
        
        updated_values = updated_data[comic_id]
        # Compare values for each field
        if any(initial_values[field] != updated_values[field] for field in initial_values if field in updated_values):
            changed_ids.append(comic_id)
    return changed_ids


# Changed to fix cursor lost error
# mysql.connector.errors.ProgrammingError: Cursor is not connected
# An unexpected error occurred of type ProgrammingError: Cursor is not connected
async def process_listings(listings, comic_image_url_id):
    # Create a new database connection for this task
    db_connection = await get_db_connection()
    cursor = db_connection.cursor()

    count = 0
    for listing in listings:
        listing = listing["node"]
        # Extract listing details
        listing_record = (
            listing["id"],
            listing["listingType"],
            listing["sellerId"],
            listing["sellerName"],
            listing["issueNumber"],
            listing["price"],
            listing.get("endingAt"),
            listing.get("bidCount"),
            listing.get("userBidStatus"),
            comic_image_url_id,
        )
        # Check if the listing already exists
        is_existing_query = "SELECT count(id) FROM veve_listings WHERE listing_id = %s"
        cursor.execute(is_existing_query, (listing["id"],))
        is_existing = cursor.fetchone()[0]

        if is_existing == 0:
            # Insert new listing into veve_listings table
            insert_query = """
                INSERT INTO veve_listings (listing_id, listing_type, seller_id, seller_name, issue_number, price, ending_at, bid_count, user_bid_status, comic_image_url_id) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
            cursor.execute(insert_query, listing_record)
            db_connection.commit()
            count += 1

    cursor.close()
    db_connection.close()
    print(f"{count} new listings added")


async def process_individual_comic(comic_id):
    query = f"""
    query marketListingFromComicCover {{
        marketListingFromComicCover (filterOptions: {{comicCoverId: "{comic_id}"}}) {{
            pageInfo {{
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }}
            edges {{
                node {{
                    id
                    listingType
                    sellerId
                    sellerName
                    issueNumber
                    price
                    endingAt
                    bidCount
                    userBidStatus
                }}
            }}
        }}
    }}
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        try: 
            response = await client.post(url, json={"query": query}, headers=headers)
            print("Request Sent", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            # Ensure the response has content and is JSON
            # print(response.headers)
            # print(response.status_code, response.headers['content-type'])
            if response.status_code == 200 and response.headers['content-type'] == 'application/json; charset=utf-8':
                data = response.json()
                if "errors" not in data:
                    listings = data["data"]["marketListingFromComicCover"]["edges"]
                    # print(listings)
                    await process_listings(listings, comic_id)
                else:
                    print(f"Error in GraphQL response for comic_id {comic_id}: {data['errors']}")
            else:
                print(f"Non-200 status code or non-JSON response for comic_id {comic_id}, status code: {response.status_code}")
        except httpx.ReadTimeout:
            print("Request Timed Out")
        except json.decoder.JSONDecodeError:
            print("Invalid JSON response")
        except Exception as e:
            logging.exception("An unexpected error occurred")
            print(f"An unexpected error occurred of type {type(e).__name__}: {e}")
            print(f"An unexpected error occurred: {e}")
            traceback.print_exc()

async def monitor_changes():
    initial_data = None
    try: 
        while True:
            print("\n###############################################################")
            start_time = time.time()  # Reset start time at the beginning of each loop iteration
            
            if initial_data is None:
                # Step 1: Initial Request
                initial_response = await fetch_listing_counts()
                initial_data = transform_response(initial_response)
                print("\nInitial Data Fetched", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            else:
                # Step 3: Second Request
                updated_response = await fetch_listing_counts()
                updated_data = transform_response(updated_response)
                print("Updated Data Fetched", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                
                # Step 4: Compare Data
                changed_ids = compare_data(initial_data, updated_data)
                if changed_ids:
                    print("IDs with changes:", changed_ids)
                    # Step 6: Request Individual `comic_id`s
                    for comic_id in changed_ids:
                        print("\nFetching listings for comic_id:", comic_id)
                        await process_individual_comic(comic_id) 
                        await asyncio.sleep(.5)
                else:
                    print("No changes detected")
                    
                # Make updated_data the initial_data for the next iteration
                initial_data = updated_data

            # Calculate total processing time for this iteration
            total_time = time.time() - start_time
            print(f"[STATS] Total processing time: {round(total_time, 2)} seconds")
            
            # Ensure at least 15 seconds wait time between iterations
            if total_time < 5:
                wait_time = 5 - total_time
                print(f"\nWaiting for {round(wait_time, 2)} seconds before the next cycle")
                await asyncio.sleep(wait_time)
    except Exception as e:
        logging.exception("An unexpected error occurred")
        print(f"An unexpected error occurred of type {type(e).__name__}: {e}")
        print(f"An unexpected error occurred: {e}")
        winsound.Beep(2500, 1000)
        traceback.print_exc()
    finally:
      cursor.close()
      db_connection.close()
      print("MySQL connection is closed")

if __name__ == "__main__":
    while True:
        asyncio.run(monitor_changes())

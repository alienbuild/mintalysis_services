

# TODO: create a json field in veve_imx_status table to store the listing data
# TODO Check for price changes and update the existing listing if the listing id is the same


import httpx
import asyncio
import winsound
import logging
import traceback
import json
import backoff
import requests
import time
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv


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

def get_ids():
    cursor.execute("SELECT collectible_id FROM veve_collectibles ORDER BY drop_date DESC")
    return cursor.fetchall()

async def fetch_listing_counts(retries=3, delay=5, timeout=30.0): # CHANGED FROM 10 sec timeout after seeing it timeout and cursor disconnecting
    query = """
        query marketListingByCollectibleType {
            marketListingByCollectibleType {
                edges {
                    node {
                        id
                        totalMarketListings
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
    for edge in response["data"]["marketListingByCollectibleType"]["edges"]:
        node = edge["node"]
        # Use the 'id' as the key and the rest of the node as the value
        data_dict[node["id"]] = node
    return data_dict


def compare_data(initial_data, updated_data):
    changed_ids = []
    for id, initial_values in initial_data.items():
        if id not in updated_data:
            continue  # Skip if the id is not found in the updated data
        
        updated_values = updated_data[id]
        # Compare values for each field
        if any(initial_values[field] != updated_values[field] for field in initial_values if field in updated_values):
            changed_ids.append(id)
    
    return changed_ids


async def process_listings(listings, collectible_id):
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
            listing.get("userBidStatus"),  # Use .get() for optional fields
            collectible_id,
        )
        # Check if the listing already exists
        is_existing_query = "SELECT count(id) FROM veve_listings WHERE listing_id = %s"
        cursor.execute(is_existing_query, (listing["id"],))
        is_existing = cursor.fetchone()[0]
        
        if is_existing == 0:
            # Insert new listing into veve_listings table
            insert_query = """
                INSERT IGNORE INTO veve_listings (listing_id, listing_type, seller_id, seller_name, issue_number, price, ending_at, bid_count, user_bid_status, collectible_id) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
            cursor.execute(insert_query, listing_record)
            db_connection.commit()
            count += 1
        # else:
        # TODO Check for price changes and update the existing listing if the listing id is the same
    print(f"{count} new listings added")


async def monitor_changes():
    initial_data = None
    while True:
      print("###############################################################")
      start_time = time.time()  # Reset start time at the beginning of each loop iteration
      if initial_data is None:
        # Step 1: Initial Request
        initial_response = await fetch_listing_counts()
        initial_data = transform_response(initial_response)
        print("\n[INFO] Initial Data Fetched", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
      else:
        # Step 3: Second Request
        updated_response = await fetch_listing_counts()
        updated_data = transform_response(updated_response)
        print("Updated Data Fetched", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

        # Step 4: Compare Data
        changed_ids = compare_data(initial_data, updated_data)
        if changed_ids:
          print("IDs with changes:", changed_ids)
          # Step 6: Request Individual `collectible_id`s
          for collectible_id in changed_ids:
            print("\nFetching listings for collectible_id:", collectible_id)
            await process_individual_collectible(collectible_id)
            await asyncio.sleep(.5)
        else:
          print("No changes detected")

        # Make updated_data the initial_data for the next iteration
        initial_data = updated_data

      # Calculate total processing time for this iteration
      total_time = time.time() - start_time
      print(f"Total processing time: {round(total_time, 2)} seconds")

      # Ensure at least 15 seconds wait time between iterations
      if total_time < 5:
        wait_time = 5 - total_time
        print(f"\nWaiting for {round(wait_time, 2)} seconds before the next cycle\n")
        await asyncio.sleep(wait_time)
            
    
async def process_individual_collectible(collectible_id):
    query = f"""
    query marketListingFromCollectibleType {{
        marketListingFromCollectibleType (filterOptions: {{collectibleTypeId: "{collectible_id}"}}) {{
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
                    listings = data["data"]["marketListingFromCollectibleType"]["edges"]
                    await process_listings(listings, collectible_id)
                else:
                    print(f"Error in GraphQL response for collectible_id {collectible_id}: {data['errors']}")
            else:
                print(f"Non-200 status code or non-JSON response for collectible_id {collectible_id}, status code: {response.status_code}")
        except httpx.ReadTimeout:
            print("Request Timed Out")
        except json.decoder.JSONDecodeError:
            print("Invalid JSON response")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

# This is how you run your async function from the top-level script
if __name__ == "__main__":
    while True:
        try:
            asyncio.run(monitor_changes())
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            winsound.Beep(2500, 1000)
            time.sleep(10)
            continue
        finally:
          cursor.close()
          db_connection.close()
          print("MySQL connection is closed")
                

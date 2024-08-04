# every 4 hours, redo check for comic id's 
# look at ByComicCover and get listing counts, check a 2nd time for any changes and request the comic ids with changes



import requests
import time
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

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

def get_comic_ids():
    cursor.execute("SELECT comic_image_url_id FROM veve_comics ORDER BY drop_date DESC")
    return cursor.fetchall()

def send_graphql_query(comic_id, retries=10, delay=5):
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
            totalCount
        }}
    }}
    """
    data = {"query": query}  # The query is now formatted directly within the function
    for attempt in range(retries):
        try:
            response = requests.post(url, json=data, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err} - Attempt {attempt + 1} of {retries}")
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise
        except Exception as err:
            print(f"An unexpected error occurred: {err}")
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                break  # Exit if retries are exhausted
    return None


def process_listings(listings, comic_image_url_id):
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
            comic_image_url_id,
        )
        # Check if the listing already exists
        is_existing_query = "SELECT count(id) FROM veve_listings WHERE listing_id = %s"
        cursor.execute(is_existing_query, (listing["id"],))
        is_existing = cursor.fetchone()[0]
        
        if is_existing == 0:
            # Insert new listing into veve_listings table
            insert_query = """
                INSERT IGNORE INTO veve_listings (listing_id, listing_type, seller_id, seller_name, issue_number, price, ending_at, bid_count, user_bid_status, comic_image_url_id) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
            cursor.execute(insert_query, listing_record)
            db_connection.commit()
            count += 1
        # else:
        # TODO Check for price changes and update the existing listing if the listing id is the same
    print(f"{count} new listings added.")

def fetch_listings():
    comic_ids = get_comic_ids()
    count = 1
    for comic_id in comic_ids:
        print("\nFetching listings for comic_id:", comic_id[0])
        response = send_graphql_query(comic_id[0])  # comic_id[0] to pass the actual ID string
        print("Request Sent", datetime.now().strftime('%Y-%m-%d %H:%M:%S'), "for comic", count, "of", len(comic_ids))
        if "errors" not in response: # Check if there are no errors in the response
            data = response["data"]["marketListingFromComicCover"]
            listings = data["edges"]
            process_listings(listings, comic_id[0])
        else:
            print("Error occurred or no data found for comic_id:", comic_id[0])
        
        time.sleep(1)  # Wait for 5 seconds before making the next request
        count += 1

# def fetch_listings():
#     comic_ids = get_comic_ids()
#     for comic_id_tuple in comic_ids:
#         comic_id = comic_id_tuple[0]
#         print("\nFetching listings for comic_id:", comic_id)
#         response = send_graphql_query(comic_id)  # Now correctly calling with comic_id
#         if response and "data" in response and "errors" not in response:
#             data = response["data"]["marketListingFromComicCover"]
#             listings = data["edges"]
#             process_listings(listings, comic_id)
#         else:
#             print("Error occurred or no data found for comic_id:", comic_id)
#         time.sleep(2)  # Short delay between requests for different comic IDs

# Main loop to repeat the process every 4 hours
while True:
    fetch_listings()
    print("\n###\nCompleted fetching all listings. Starting from the top.\n###\n")
    # time.sleep(4 * 60 * 60)  # 4 hours in seconds





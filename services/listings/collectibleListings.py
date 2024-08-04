
# get listing counts, check a 2nd time for any changes and request the collectible ids with changes

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

wait_time = 5
pause = 1
def get_collectible_ids():
    cursor.execute("SELECT collectible_id FROM veve_collectibles ORDER BY drop_date Desc")
    return cursor.fetchall()

def send_graphql_query(collectible_id, retries=10, delay=5):
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
                cursor
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


def process_listings(listings, collectible_id):
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
    print(f"{count} new listings added.")

def fetch_listings():
    collectible_ids = get_collectible_ids()
    count = 1
    for collectible_id in collectible_ids:
        print("\nFetching listings for collectible_id:", collectible_id[0])
        response = send_graphql_query(collectible_id[0])  # collectible_id[0] to pass the actual ID string
        print(f"Request Sent at", datetime.now().strftime('%Y-%m-%d %H:%M:%S'), "for collectible", count, "of", len(collectible_ids))
        if "errors" not in response: # Check if there are no errors in the response
            data = response["data"]["marketListingFromCollectibleType"]
            listings = data["edges"]
            process_listings(listings, collectible_id[0])
        else:
            print("No data found for collectible_id:", collectible_id[0], "Error:", response["errors"])
        time.sleep(pause)  # Wait for 5 seconds before making the next request
        count += 1

# Main loop to repeat the process every 4 hours
while True:
    fetch_listings()
    print("Completed fetching all listings. Starting the cycle over.")
    print(f"Waiting for 5 sec to recheck")
    # time.sleep(wait_time)

# FIX ME
# 502 error not re-requesting
# Fetching listings for collectible_id: 004434cb-6ab4-4b16-9858-5f554f0c2520
# Request Sent at 2024-05-02 08:08:27 for collectible 460 of 1342
# 0 new listings added.

# Fetching listings for collectible_id: 49ebb3bc-9ac4-43cd-a734-5aee8c6d67ef
# HTTP error occurred: 502 Server Error: Bad Gateway for url: 
# https://web.api.prod.veve.me/graphql - Attempt 1 of 10      
# Request Sent at 2024-05-02 08:08:36 for collectible 461 of 1342
# 0 new listings added.

# Fetching listings for collectible_id: fe0982da-ddc5-40b1-8da2-bb4d20d0faba
# Request Sent at 2024-05-02 08:08:39 for collectible 462 of 1342
# 0 new listings added.

# This is returning a 502 error but not requesting the collectible_id again. The error should be handled and the request should be made again for the same collectible_id


# 
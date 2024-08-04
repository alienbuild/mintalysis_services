

import requests
import winsound
import time
import mysql.connector
from datetime import datetime
import os
import json
from dotenv import load_dotenv
import logging

load_dotenv()

# Configuration
DB_CONFIG = {
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'database': os.getenv('DB_NAME')
}

VEVE_API_URL = "https://web.api.prod.veve.me/graphql"
REFRESH_TOKEN_URL = "https://auth-api.veve.me/web/token/refresh"
CLIENT_ID = "7125d6ff-cd38-4024-b58f-d88f93334f29"
INITIAL_REFRESH_TOKEN = os.getenv('VEVE_REFRESH_TOKEN') 
REFRESH_INTERVAL = 12 * 60 * 60  # 12 hours in seconds
REFRESH_THRESHOLD = 29 * 24 * 60 * 60  # 29 days in seconds

# Global variables for managing tokens
current_refresh_token = INITIAL_REFRESH_TOKEN
last_refresh_time = time.time()  # Initialize to the current time
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


def refresh_tokens():
    """Refreshes the access token and updates it in the cookie header."""
    global current_refresh_token, headers
    logging.info("Refreshing access token...")
    headers_refresh = {"Content-Type": "application/json"}
    cookies_refresh = {"vv.rt": current_refresh_token}
    data = {"clientId": CLIENT_ID}

    try:
        response = requests.post(
            REFRESH_TOKEN_URL, headers=headers_refresh, cookies=cookies_refresh, data=json.dumps(data)
        )
        response.raise_for_status()

        # Extract and update both tokens
        new_access_token = response.cookies.get("vv.at")
        new_csrf_token = response.headers.get("csrf-token")

        if new_access_token and new_csrf_token:
            current_access_token = new_access_token

            # Update the cookie string in the headers
            cookie_parts = headers["cookie"].split("; ")
            updated_cookie_parts = []
            for part in cookie_parts:
                if part.startswith("vv.at="):
                    updated_cookie_parts.append(f"vv.at={new_access_token}")
                else:
                    updated_cookie_parts.append(part)
            headers["cookie"] = "; ".join(updated_cookie_parts)

            # Update the csrf-token in the headers
            headers["csrf-token"] = new_csrf_token

            logging.info("Tokens refreshed successfully!")
            return True
        else:
            logging.error("Token refresh failed: Could not retrieve new tokens from response.")
            return False

    except requests.exceptions.RequestException as e:
        logging.error(f"Token refresh failed: {e}")
        return False


def send_graphql_query(query):
    data = {
        "query": query
    }

    try:
        response = requests.post(VEVE_API_URL, json=data, headers=headers)
        response.raise_for_status()
        response_json = response.json()
        return response_json

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"Request error occurred: {req_err}")
    except Exception as err:
        print(f"An error occurred: {err}")
    return None

def process_listings(listings):
    listing_records = []
    count = 0
    for listing in listings:
        # Convert Unix timestamp to the desired format
        # unix_timestamp = listing["txn_time"]
        # datetime_obj = datetime.fromtimestamp(unix_timestamp / 1000)
        # listing["txn_time"] = datetime_obj.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        
        listing = listing["node"]
        
        # Process each listing entry as needed
        listing_id = listing["id"]
        listing_type = listing["listingType"]
        seller_id = listing["sellerId"]
        seller_name = listing["sellerName"]
        issue_number = listing["issueNumber"]
        ending_at = listing["endingAt"]
        bid_count = listing["bidCount"]
        price = listing["price"]
        user_bid_status = listing["userBidStatus"]
        collectible_id = listing["collectibleTypeId"]
        name = listing["name"]
        rarity = listing["rarity"]
        edition_type = listing["editionType"]
        listing_record = (listing_id, listing_type, seller_id, seller_name, issue_number, ending_at, bid_count, price, user_bid_status, collectible_id, name, rarity, edition_type)
        
        # Process each listing entry as needed
        # print(listing)
        is_existing_query = "SELECT count(id) FROM veve_listings WHERE listing_id = %s"
        cursor.execute(is_existing_query, (listing_id,))
        is_existing = cursor.fetchone()[0]
        if is_existing == 0:
            # Update listing data in veve_listings table
            query = """
                INSERT IGNORE INTO veve_listings (listing_id, listing_type, seller_id, seller_name, issue_number, ending_at, bid_count, price, user_bid_status, collectible_id, name, rarity, edition_type) 
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """
            cursor.execute(query, listing_record,)
            db_connection.commit()
            count += 1
    print(f"{count} new listings added")
    # if count >= 4:
    time.sleep(2) # Since no pagination, request faster to make sure we get all new listings
    # else:
    #   time.sleep(2)  # Wait for 10 seconds before making the next request

def fetch_listings_with_pagination(query):
    while True:
        response = send_graphql_query(query)
        print("Request Sent " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        if response is not None and "data" in response:
            data = response["data"]
            if "marketListingNewCollectibles" in data:
                listings = data["marketListingNewCollectibles"]["edges"]
                # next_token = data["marketListingNewCollectibles"]["endCursor"]

                process_listings(listings)

            else:
                print("No 'marketListingNewCollectibles' field in the response.")
                break
        else:
            print("Error occurred while fetching listings.")
            break

# GraphQL query
query = """
 query marketListingNewCollectibles {
         marketListingNewCollectibles{
             pageInfo {
                 hasNextPage
                 hasPreviousPage
                 startCursor
                 endCursor
             }
             edges {
                 node{
 								id
                 listingType
                 sellerId
                 sellerName
                 issueNumber
                 endingAt
                 bidCount
                 price
                 userBidStatus
                 collectibleTypeId
                 name
                 rarity
                 editionType
             }
         }
     }
 }
"""

if __name__ == "__main__":
    # MySQL database connection
    db_connection = mysql.connector.connect(**DB_CONFIG)
    cursor = db_connection.cursor()
    try:
        while True:
            fetch_listings_with_pagination(query)

            # Check for token refresh (outside the exception block)
            elapsed_time = time.time() - last_refresh_time
            if elapsed_time >= REFRESH_INTERVAL or elapsed_time >= REFRESH_THRESHOLD:
                if refresh_tokens():
                    last_refresh_time = time.time()

    except Exception as e:
        # Attempt to refresh tokens on ANY exception
        logging.error(f"Error occurred: {e}")
        winsound.Beep(2500, 1000)
        logging.info("Attempting to refresh tokens due to error...")

        if refresh_tokens():
            logging.info("Token refresh successful. Resuming...")
            last_refresh_time = time.time()
            fetch_listings_with_pagination(query)  # Retry the function
        else:
            logging.error("Token refresh failed. Restarting in 10 seconds...")
            time.sleep(10)

    finally:
        cursor.close()
        db_connection.close()

###GEMINI CODE ABOVE


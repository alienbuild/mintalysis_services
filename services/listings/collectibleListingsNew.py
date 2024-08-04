

import requests
import winsound
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
    'database': os.getenv('DB_NAME')
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

def send_graphql_query(query):
    data = {
        "query": query
    }

    try:
        response = requests.post(url, json=data, headers=headers)
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
    time.sleep(2)
    # else:
    #   time.sleep(2)  

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


# This is how you run your async function from the top-level script
if __name__ == "__main__":
  try: 
    while True:
        fetch_listings_with_pagination(query)
  except Exception as e:
    winsound.Beep(2500, 1000)
    print("Error occurred. Restarting in 10 seconds...")
    time.sleep(10)
    os.system('python "C:/Users/XXXD/Desktop/OMI BURN DAILY/Metadata_app/_CODE/SQL_CODE/UPDATE_DB/LIVE_UPDATE/SCRIPTS/collectibleListingsnew.py"')
  except KeyboardInterrupt:
    print("Process interrupted by user.")
  finally:
    cursor.close()
    db_connection.close()
    
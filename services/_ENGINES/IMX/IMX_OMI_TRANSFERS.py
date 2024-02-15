# "C:/Program Files/Python38/python.exe" "C:/Users/XXXD/Desktop/OMI BURN DAILY/Mintalysis/mintalysis_services/services/_ENGINES/IMX/IMX_OMI_TRANSFERS.py"

import requests
import mysql.connector
import os
import time
import logging
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# API and database configurations
BASE_URL = 'https://api.x.immutable.com/v1/transfers'
token_address = '0xed35af169af46a02ee13b9d79eb57d6d68c1749e'
page_size = 200
direction = 'asc'
order_by = 'transaction_id'
headers = {'Accept': 'application/json', 'Content-Type': 'application/json', "api-key": os.getenv('IMX_PUBLIC_API_KEY')}
db_config = {'user': os.getenv('DB_USER'), 'password': os.getenv('DB_PASSWORD'), 'host': os.getenv('DB_HOST'), 'database': os.getenv('DB_NAME')}
table_name = 'omi_transfers'
SLEEP_TIME = 10  # Pause to avoid hitting API rate limits
first_run = True
api_cursor = None

def convert_to_datetime(timestamp_str):
    try:
        # First try to parse the timestamp with microseconds
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        # If it fails, parse it without microseconds
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")


def format_timestamp_for_db(datetime_obj):
    # Format datetime object back to string in the desired format
    return datetime_obj.strftime('%Y-%m-%dT%H:%M:%SZ')

def get_saved_cursor(cursor, table_name):
    cursor.execute("SELECT next_cursor FROM veve_imx_status WHERE table_name = %s", (table_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def get_saved_timestamp(cursor, table_name):
    cursor.execute("SELECT last_timestamp FROM veve_imx_status WHERE table_name = %s", (table_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def update_status(cursor, table_name, next_cursor, last_timestamp, last_txn_id, updatedAt):
    cursor.execute("""
        INSERT INTO veve_imx_status (table_name, next_cursor, last_timestamp, last_txn_id, updatedAt)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            next_cursor = VALUES(next_cursor),
            last_timestamp = VALUES(last_timestamp),
            last_txn_id = VALUES(last_txn_id),
            updatedAt = VALUES(updatedAt)
    """, (table_name, next_cursor, last_timestamp, last_txn_id, updatedAt))

def get_data_with_retry(url, headers, max_retries=5, backoff_factor=1.5):
    retry_count = 0
    while retry_count < max_retries:
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()  # or however you process the response
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:  # Too Many Requests
                wait_time = backoff_factor * (2 ** retry_count)
                logging.info(f"Rate limit hit. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                retry_count += 1
            else:
                raise e
        except requests.exceptions.RequestException as e:
            logging.error(f"Request failed: {e}")
            break  # or you might choose to retry here as well

    raise Exception("Max retries reached")

try:
    with mysql.connector.connect(**db_config) as conn:
        with conn.cursor() as cursor:
            logging.info("Database connection established\n")
            # api_cursor = get_saved_cursor(cursor, table_name)

            insert_query = """
            INSERT IGNORE INTO omi_transfers 
            (transaction_id, status, user, receiver, token_address, decimals, quantity, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """

            while True:
                base_url_with_params = f"{BASE_URL}?token_address={token_address}&page_size={page_size}&direction={direction}&order_by={order_by}"

                if first_run == True:
                    min_timestamp = get_saved_timestamp(cursor, table_name)
                    first_run = False
                    if min_timestamp:
                        base_url_with_params += f"&min_timestamp={min_timestamp}"
                else: 
                    api_cursor = get_saved_cursor(cursor, table_name)  # Get saved cursor if available
                    if api_cursor:
                        base_url_with_params += f"&cursor={api_cursor}"

                try:
                    print(f'Requesting: {base_url_with_params}')
                    data = get_data_with_retry(base_url_with_params, headers=headers)
                    result = data.get('result', [])
                except requests.exceptions.HTTPError as e:
                    logging.error(f"HTTP Error: {e}")
                    continue
                except requests.exceptions.RequestException as e:
                    logging.error(f"Request Error: {e}")
                    continue

                if result:
                    max_timestamp = None
                    last_txn_id = None
                    batch_data = []

                    for record in result:
                        transaction_id = record.get('transaction_id')
                        timestamp_str = record.get('timestamp')
                        timestamp = convert_to_datetime(timestamp_str)
                        formatted_timestamp = format_timestamp_for_db(timestamp)
                        updatedAt = datetime.now()

                        if max_timestamp is None or timestamp > max_timestamp:
                            max_timestamp = timestamp
                            last_txn_id = transaction_id

                        batch_data.append((transaction_id, record.get('status'), record.get('user'), record.get('receiver'), record.get('token', {}).get('data', {}).get('token_address'), record.get('token', {}).get('data', {}).get('decimals'), record.get('token', {}).get('data', {}).get('quantity'), formatted_timestamp))

                    api_cursor = data.get('cursor', api_cursor)  # Update cursor for next iteration
                    
                    if batch_data:
                        cursor.executemany(insert_query, batch_data)
                        conn.commit()
                        logging.info(f"Batch of {len(batch_data)} records committed to the database")
                        update_status(cursor, table_name, api_cursor, formatted_timestamp, last_txn_id, updatedAt)
                        conn.commit()
                        logging.info(f"Last timestamp processed: {max_timestamp}\n")
                    
                else:
                    logging.info(f"No new data to process. Retaining the current API cursor. Last timestamp: {max_timestamp}\n")
                
                
                time.sleep(SLEEP_TIME)  # Pause to avoid hitting API rate limits

except KeyboardInterrupt:
    logging.info("Script stopped manually")
except Exception as e:
    logging.error(f"Unexpected Error: {e}")

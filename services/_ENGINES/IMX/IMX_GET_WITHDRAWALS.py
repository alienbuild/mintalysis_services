import time
import requests
from datetime import datetime
import os
import mysql.connector
from dotenv import load_dotenv
from decimal import Decimal, getcontext
import logging

load_dotenv()

# Set precision for decimal operations
getcontext().prec = 28

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

BASE_URL = 'https://api.x.immutable.com/v1/withdrawals'
headers = {'Accept': 'application/json', 'Content-Type': 'application/json', "api-key": os.getenv('IMX_PUBLIC_API_KEY')}
db_config = {'user': os.getenv('DB_USER'), 'password': os.getenv('DB_PASSWORD'), 'host': os.getenv('DB_HOST'), 'database': os.getenv('DB_NAME')}
table_name = 'imx_withdrawals'
status = 'success'
page_size = '200'
direction = 'asc'
order_by = 'transaction_id'
batch_size = 200
SLEEP_TIME = 30  # Pause to avoid hitting API rate limits
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

            insert_query = """
            INSERT IGNORE INTO imx_withdrawals
            (txn_id, status, rollup_status, sender, token_type, token_id, imx_id, token_address, token_decimals, token_qty, token_qty_with_fees, timestamp, updatedAt)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            while True:
                base_url_with_params = f"{BASE_URL}?status={status}&page_size={page_size}&direction={direction}&order_by={order_by}"
                
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
                        status = record.get('status')
                        rollup_status = record.get('rollup_status')
                        sender = record.get('sender')
                        token_type = record['token'].get('type')
                        token_id = record['token']['data'].get('token_id')
                        imx_id = record['token']['data'].get('id')
                        token_address = record['token']['data'].get('token_address')
                        decimals = record['token']['data'].get('decimals')
                        quantity = record['token']['data'].get('quantity')
                        quantity_with_fees = record['token']['data'].get('quantity_with_fees')
                        timestamp_str = record.get('timestamp')
                        timestamp_d = convert_to_datetime(timestamp_str)
                        formatted_timestamp = format_timestamp_for_db(timestamp_d)
                        updatedAt = datetime.now()

                        batch_data.append((transaction_id, status, rollup_status, sender, token_type, token_id, imx_id, 
                                          token_address, decimals, quantity, quantity_with_fees, formatted_timestamp, updatedAt))
                        
                        if max_timestamp is None or timestamp_d > max_timestamp:
                            max_timestamp = timestamp_d
                            last_txn_id = transaction_id

                    api_cursor = data.get('cursor', api_cursor)
                    
                    if batch_data:
                        cursor.executemany(insert_query, batch_data)
                        conn.commit()
                        logging.info(f"Batch of {len(batch_data)} records committed to the database")
                        update_status(cursor, table_name, api_cursor, formatted_timestamp, last_txn_id, updatedAt)
                        conn.commit()
                        logging.info(f"Status updated. Most recent timestamp: {max_timestamp}\n")

                else: 
                    logging.info(f"No new data to process. Retaining the current API cursor. Last timestamp: {max_timestamp}\n")

                logging.info(f'Pausing for {SLEEP_TIME} sec')
                time.sleep(SLEEP_TIME)

except KeyboardInterrupt:
    logging.info("Script stopped manually")
except Exception as e:
    logging.error(f"Unexpected Error: {e}")


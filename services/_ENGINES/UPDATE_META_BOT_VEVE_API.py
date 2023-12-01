import requests
import mysql.connector
import time
import os
import logging
import re
import random
from dotenv import load_dotenv

load_dotenv()

# API endpoints configuration
mintable_token_endpoint = 'https://api.x.immutable.com/v1/mintable-token/0xa7aefead2f25972d80516628417ac46b3f2604af/'
veve_api_endpoint = 'https://api.prod.veve.me/api/nft/metadata/' 
# veve_api_count = 0

# Define the maximum number of requests per second
MAX_REQUESTS_PER_SECOND = 5

# Get the highest processed token_id or initialize to 0
highest_processed_token_id = 0

# Define the db_config dictionary with environment variables
db_config = {
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'database': os.getenv('DB_NAME')
}

# Configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# Function to establish a MySQL database connection
def establish_db_connection():
    return mysql.connector.connect(**db_config)

# Function to close a MySQL database connection
def close_db_connection(connection):
    connection.close()

# Error handling for database queries
def execute_query(connection, query, data=None):
    cursor = connection.cursor()
    try:
        cursor.execute(query, data)
        connection.commit()
    except mysql.connector.Error as err:
        # logger.error(f"Error executing query: {err}")
        print(f"[ERROR] Error executing query: {err}")

# Function to get the highest token_id from the database
def get_highest_token_id(connection):
    cursor = connection.cursor()
    query = "SELECT MAX(token_id) FROM veve_tokens"
    cursor.execute(query)
    result = cursor.fetchone()
    return result[0] if result[0] else 0

# UPDATE is_name_unique using collectibles and comic names in veve_collectibles
def update_unique_collectible_names_flag(connection):
    cursor = connection.cursor()
    query = """
        UPDATE veve_collectibles AS v
        SET v.is_name_unique = CASE
            WHEN (
                SELECT COUNT(*)
                FROM (
                    SELECT name FROM veve_comics
                    UNION ALL
                    SELECT name FROM veve_collectibles
                ) AS combined
                WHERE combined.name = v.name
            ) = 1 THEN 1
            ELSE 0
        END;
    """
    cursor.execute(query)
    connection.commit()


# Function to get token_ids from veve_tokens that are missing name and edition
def get_missing_metadata_db(connection):
    cursor = connection.cursor()

    query = f"select * from veve_tokens where (name is null or edition is null or type is null or rarity is null) and is_invalid = 0 and is_premint = 0 and token_id > {highest_processed_token_id} ORDER BY token_id ASC"
    #query = f"select * from veve_tokens where (name is null or edition is null or type is null or rarity is null) and is_invalid = 0 and is_premint = 0 ORDER BY token_id ASC"
    cursor.execute(query)
    result = cursor.fetchall()
    return result

# Function to get the total number of tokens in the list of token IDs
def get_total_tokens_in_list(connection):
    cursor = connection.cursor()

    query = f"select count(*) from veve_tokens where (name is null or edition is null or type is null or rarity is null) and is_invalid = 0 and is_premint = 0 and token_id > {highest_processed_token_id}"
    # query = f"select count(*) from veve_tokens where (name is null or edition is null or type is null or rarity is null) and is_invalid = 0 and is_premint = 0"
    cursor.execute(query)
    result = cursor.fetchone()
    return result[0] if result else 0

# Function to get the mintable token
def get_mintable_token(token_id):
    headers = {"Content-Type": "application/json", "api-key": os.getenv('IMX_PUBLIC_API_KEY')}
    try:
        mintable_token_response = requests.get(mintable_token_endpoint + token_id, headers=headers)
        mintable_token_response.raise_for_status()
        return mintable_token_response.json()
    except requests.exceptions.RequestException as req_err:
        # logger.error(f"\nError in get_mintable_token for token_id {token_id}: {req_err}")
        print(f"[ERROR] Error in get_mintable_token for token_id {token_id}: {req_err}\n")
        return None

# Split the blueprint by the last comma to separate name and edition
def split_blueprint(blueprint):
    split_comma = blueprint.rsplit(',', 1)

    # Ensure that there are at least two parts (name and edition)
    if len(split_comma) >= 2:
        return map(str.strip, split_comma)
    else:
        # Handle the case when there's no valid name and edition
        return ('', '')
    
def extract_unique_id(token):
    try:
        re_comic = r'comic_cover\.([a-f\d-]+)\.'
        re_collectible = r'collectible_type_image\.([a-f\d-]+)\.'
        image_url = token.get('image', None)

        if image_url and len(image_url) > 0:
            comic_match = re.search(re_comic, image_url)
            collectible_match = re.search(re_collectible, image_url)

            if comic_match:
                return {'type': 'comic', 'comicOrCollectibleId': comic_match.group(1)}
            elif collectible_match:
                return {'type': 'collectible', 'comicOrCollectibleId': collectible_match.group(1)}

    except Exception as e:
        print(f'[ERROR] Unable to extract id from image_url for token: {token_id}', e)

# Function to get veve api metadata
def get_veve_api_metadata(token_id):
    headers = {"Content-Type": "application/json"}
    
    try:
        veve_api_token_response = requests.get(veve_api_endpoint + token_id, headers=headers)
        veve_api_token_response.raise_for_status()
        return veve_api_token_response.json()
    except requests.exceptions.RequestException as req_err:
        # logger.error(f"Error in get_mintable_token for token_id {token_id}  with name {name} and edition {edition}: {req_err}")
        print(f"[ERROR] Error in get_veve_api_metadata for token_id {token_id}  with name {name} and edition {edition}: {req_err}")
        return None

# Function to check and update metadata
def check_update_meta(connection, token_id, name, edition):
    cursor = connection.cursor()

    # Check if the collectible exists in the database before hitting the VeVe API
    # Strip off the ' and , from name in veve_collectibles because mintable_token might not have them
    collectible_query = """
    SELECT 
        collectible_id, 
        rarity, 
        brand_id, 
        licensor_id, 
        series_id, 
        name 
    FROM 
        veve_collectibles 
    WHERE 
        (name = %s OR REPLACE(REPLACE(name, "\'", ""), ",", "") = %s) 
        AND is_name_unique = 1
    """
    
    cursor.execute(collectible_query, (name, name))
    collectible_result = cursor.fetchone()

    # Unique name found in the veve_collectibles
    if collectible_result:
        update_collectible_metadata(connection, token_id, collectible_result, edition)
        print(f"[SUCCESS] Updated metadata for TOKEN_ID {token_id} with NAME {name} and EDITION {edition} from matching IMX and veve_collectibles\n")
        return True
    else:
        return False

def update_from_veve_api(connection, token_id, name, edition):
    cursor = connection.cursor()
    # If not found in the database, check VeVe API for metadata
    print(f"\n[INFO] {name} doesn't exist in veve_collectibles or it's not a unique name. Checking VEVE API for metadata")
    veve_api_metadata = get_veve_api_metadata(token_id)

    if veve_api_metadata:
        result = extract_unique_id(veve_api_metadata)
        if result:
            type = result.get('type')
            comicOrCollectibleId = result.get('comicOrCollectibleId')

            if type == 'comic':
                comic_query = "SELECT unique_cover_id, comic_image_url_id, name, rarity FROM veve_comics WHERE comic_image_url_id = %s"
                cursor.execute(comic_query, (comicOrCollectibleId,))
            elif type == 'collectible':
                collectible_query = "SELECT collectible_id, rarity, brand_id, licensor_id, series_id, name FROM veve_collectibles WHERE collectible_id = %s"
                cursor.execute(collectible_query, (comicOrCollectibleId,))
            else:
                print(f"[ERROR] Unknown type {type} for token_id {token_id} with name {name} and edition {edition}")
                return

            type_result = cursor.fetchone()

            if type_result:
                update_metadata_fn = update_comic_metadata if type == 'comic' else update_collectible_metadata
                update_metadata_fn(connection, token_id, type_result, edition)
                print(f"[SUCCESS] Updated metadata for TOKEN_ID {token_id} with TYPE {type} and NAME {name} and EDITION {edition} using the VEVE API\n")
                return
            else:
                print(f"[ERROR] {type.capitalize()} not found for token_id {token_id} with name {name} and edition {edition}")
                return
        else:
            print(f"[ERROR] Unable to extract unique id for token_id {token_id} with name {name} and edition {edition}")
            return
    else:
        print(f"[PREMINT] No VeVe API metadata for token_id: {token_id} Name: {name} Edition: {edition}. Marking as a Premint!\n")
        query = """
            UPDATE veve_tokens
            SET name = %s, edition = %s, last_updated = NOW(), to_process = 1, is_premint = 1
            WHERE token_id = %s
        """
        data = (name, edition, token_id)
        execute_query(connection, query, data)
        return          

# Function to update veve_tokens with metadata
def update_collectible_metadata(connection, token_id, result, edition):
    collectible_id, rarity, brand_id, licensor_id, series_id, name = result
    token_id = int(token_id)

    query = """
        UPDATE veve_tokens
        SET collectible_id = %s, rarity = %s, brand_id = %s, licensor_id = %s, series_id = %s, name = %s, edition = %s, is_premint = 0, type = 'collectible', last_updated = NOW()
        WHERE token_id = %s
    """
    data = (collectible_id, rarity, brand_id, licensor_id, series_id, name, edition, token_id)

    execute_query(connection, query, data)

def update_comic_metadata(connection, token_id, result, edition):
    unique_cover_id, comic_image_url_id, name, rarity = result
    token_id = int(token_id)

    query = """
        UPDATE veve_tokens
        SET unique_cover_id = %s, comic_image_url_id = %s, name = %s, edition = %s, rarity = %s, is_premint = 0, type = 'comic', last_updated = NOW()
        WHERE token_id = %s
    """
    data = (unique_cover_id, comic_image_url_id, name, edition, rarity, token_id)

    execute_query(connection, query, data)

# Function to get the token_ids that are labeled as a premint
def get_premint_token_ids(connection):
    cursor = connection.cursor()
    query = "SELECT token_id FROM veve_tokens where is_premint = 1"
    cursor.execute(query)
    result = cursor.fetchall()
    return result

if __name__ == "__main__":
    db_connection = establish_db_connection()
    premint_check_count = 0
    veve_api_count = 0
    
    # Update unique names before starting
    print('Updating unique name flag in veve_collectibles table')
    update_unique_collectible_names_flag(db_connection) 
    while True:
        # Get the highest token_id from veve_tokens
        # highest_db_token_id = get_highest_token_id(db_connection)
        count = 0
        
        # Get token_ids from veve_tokens that are missing name and edition
        print(f"Getting missing metadata tokens from database")
        missing_metadata_tokens = get_missing_metadata_db(db_connection)

        # Extract the list of token IDs
        token_ids = [str(token[0]) for token in missing_metadata_tokens]

        # Get the total number of tokens in the list
        total_tokens_in_list = get_total_tokens_in_list(db_connection)
        print(f"Total tokens in the list: {total_tokens_in_list}\n")

        # Process tokens with token_id greater than the highest_processed_token_id
        for token_id in missing_metadata_tokens:
            token_id = str(token_id[0])
            mintable_token_json = get_mintable_token(token_id)

            if mintable_token_json and 'blueprint' in mintable_token_json:
                # blueprint has the name and edition
                blueprint = mintable_token_json['blueprint']
                name, edition = split_blueprint(blueprint)
            
                # Check and update metadata
                result = check_update_meta(db_connection, token_id, name, edition) 
                
                if result == False:
                    update_from_veve_api(db_connection, token_id, name, edition)
                    time.sleep(random.uniform(.3,.7))
                    veve_api_count += 1
                    
                # Update the highest_processed_token_id
                highest_processed_token_id = int(token_id)
                print(f"Updated highest_processed_token_id to {highest_processed_token_id}\n")

                # Introduce a delay to limit requests
                time.sleep(1 / MAX_REQUESTS_PER_SECOND)
                
            count += 1
            print(f"Processed {count} tokens of {total_tokens_in_list}\n")
            
            if veve_api_count % 500 == 0 and veve_api_count > 0:
                print('Pausing for 2.5 min')
                time.sleep(150)
            
        if premint_check_count % 960 == 0 and premint_check_count > 0: # Every 8 hours, check the premints for new data
            print("Checking for new metadata for premints")
            update_unique_collectible_names_flag(db_connection) 
            premint_token_ids = get_premint_token_ids(db_connection)
            token_ids = [str(token[0]) for token in premint_token_ids] 
            total_premints_to_check = len(token_ids)
            print(f"Total premints in the list: {total_premints_to_check}\n")
            for token_id in token_ids:
                mintable_token_json = get_mintable_token(token_id)
                blueprint = mintable_token_json['blueprint']
                name, edition = split_blueprint(blueprint)
            
                # Check and update metadata
                result = check_update_meta(db_connection, token_id, name, edition) 
                
                if result == False:
                    update_from_veve_api(db_connection, token_id, name, edition)
                    time.sleep(random.uniform(.3,.7))
                    veve_api_count += 1

                # Introduce a delay to limit requests
                time.sleep(1 / MAX_REQUESTS_PER_SECOND)
                print(f"Processed {premint_check_count} tokens of {total_premints_to_check}\n")
                
                if veve_api_count % 500 == 0 and veve_api_count > 0:
                    print('Pausing for 2.5 min')
                    time.sleep(150)
            premint_check_count = 0
            
        # Sleep for 30 seconds before checking again
        print('Pausing for 30 sec')
        time.sleep(30)
        premint_check_count += 1

    close_db_connection(db_connection)
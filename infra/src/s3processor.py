import json
import boto3
import os

def lambda_handler(event, context):
    s3_client = boto3.client('s3')
    
    # Get source bucket and key from the EventBridge event
    source_bucket = event['detail']['bucket']['name']
    source_key = event['detail']['object']['key']
    
    # Get object metadata
    response = s3_client.head_object(
        Bucket=source_bucket,
        Key=source_key
    )
    
    # Extract CaseId and USER from metadata
    metadata = response.get('Metadata', {})
    case_id = metadata.get('caseid', 'default_case')  # Assuming metadata key is 'caseid'
    user_email = metadata.get('user', 'default@amazon.com')  # Assuming metadata key is 'user'
    
    # Create JSON in the required format
    access_json = {
        "Attributes": {
            "CaseId": case_id
        },
        "AccessControlList": [
            {
                "Access": "ALLOW",
                "Name": user_email,
                "Type": "USER"
            }
        ]
    }
    
    # Create metadata file path with .metadata.json extension
    json_key = f"{source_key}.metadata.json"
    
    # Upload JSON file
    s3_client.put_object(
        Bucket=source_bucket,
        Key=json_key,
        Body=json.dumps(access_json),
        ContentType='application/json'
    )
    
    return {
        'statusCode': 200,
        'metadata_file': json_key
    }
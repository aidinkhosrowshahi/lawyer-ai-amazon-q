import json
import os
import uuid
import boto3
from datetime import datetime
from typing import Dict, Any
from botocore.config import Config
from typing import Dict

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['CASES_TABLE'])

# def generate_presigned_url(case_id: str, file_name: str, expiration: int = 3600) -> Dict[str, str]:
#     try:
#         s3_client = boto3.client(
#             's3',
#             config=Config(signature_version='s3v4')
#         )
        
#         bucket_name = os.environ['UPLOAD_BUCKET_NAME']
#         s3_key = f"cases/{case_id}.pdf"

#         # Generate the presigned URL for PUT operation
#         presigned_url = s3_client.generate_presigned_url(
#             'put_object',
#             Params={
#                 'Bucket': bucket_name,
#                 'Key': s3_key,
#                 'ContentType': 'application/octet-stream'
#             },
#             ExpiresIn=expiration,
#             HttpMethod='PUT'
#         )

#         signedUrl = f'curl -X PUT -T "template.yaml" -H "Content-Type: application/octet-stream" "{presigned_url}"'.replace('\\', '')
#         return signedUrl

#         #return presigned_url



#     except Exception as e:
#         raise Exception(f"Error generating presigned URL: {str(e)}")

def create_case(body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new case with the provided description."""
    case_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    

    item = {
        'caseId': case_id,
        'description': body.get('description', ''),
        'title': body.get('title', ''),
        'metadata': body.get('metadata', {}),
        'createdAt': timestamp,
        'updatedAt': timestamp,
        'uploadUrl': 'https://dev.d197rh1tj5eu5g.amplifyapp.com/'
    }
    
    table.put_item(Item=item)
    return item

def get_case(case_id: str) -> Dict[str, Any]:
    """Retrieve a case by its ID."""
    response = table.get_item(Key={'caseId': case_id})
    item = response.get('Item')
    if not item:
        raise ValueError(f"Case with ID {case_id} not found")
    return item

def list_cases() -> Dict[str, Any]:
    """List all cases."""
    response = table.scan()
    return {'cases': response.get('Items', [])}

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main handler for case management API."""
    try:
        method = event['httpMethod']
        path = event['path']
        
        if method == 'POST' and path == '/cases':
            body = json.loads(event['body']) if event.get('body') else {}
            result = create_case(body)
            print(json.dumps(result))
            return {
                'statusCode': 201,
                'body': json.dumps(result),
                'headers': {
                    'Content-Type': 'application/json'
                }
            }
            print(json.dumps(result))
        


        elif method == 'GET' and path == '/cases':
            result = list_cases()
            return {
                'statusCode': 200,
                'body': json.dumps(result),
                'headers': {
                    'Content-Type': 'application/json'
                }
            }

        elif method == 'GET' and path.startswith('/cases/'):
            case_id = path.split('/')[-1]  # Extract case_id from the path
            result = get_case(case_id)
            print(result['signedUrl'])
            #print(json.dumps(result['url']))
            return {
                'statusCode': 200,
                'body': json.dumps(result['signedUrl']),
                'headers': {
                    'Content-Type': 'application/json'
                }
            }
            
            #'body': json.dumps(result),


        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Not found'}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }
        
    except ValueError as e:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': str(e)}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
            'headers': {
                'Content-Type': 'application/json'
            }
        }
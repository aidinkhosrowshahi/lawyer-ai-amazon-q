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
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    try:
        method = event['httpMethod']
        path = event['path']
        
        # Handle OPTIONS requests for CORS preflight
        if method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': ''
            }
        
        if method == 'POST' and path == '/cases':
            body = json.loads(event['body']) if event.get('body') else {}
            result = create_case(body)
            print(json.dumps(result))
            return {
                'statusCode': 201,
                'body': json.dumps(result),
                'headers': {**cors_headers,
                    'Content-Type': 'application/json'
                }
            }
            print(json.dumps(result))
        


        elif method == 'GET' and (path == '/cases' or path == '/case'):
            result = list_cases()
            return {
                'statusCode': 200,
                'body': json.dumps(result['status']),
                'headers': {
                    **cors_headers,
                    'Content-Type': 'application/json'
                }
            }

        elif method == 'GET' and path.startswith('/cases/'):
            case_id = path.split('/')[-1]  # Extract case_id from the path
            result = get_case(case_id)
            return {
                'statusCode': 200,
                 'body': json.dumps(result['status']),
                'headers': {
                    **cors_headers,
                    'Content-Type': 'application/json'
                }
            }
            
            #'body': json.dumps(result),


        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Not found'}),
            'headers': {
                **cors_headers,
                'Content-Type': 'application/json'
            }
        }
        
    except ValueError as e:
        return {
            'statusCode': 404,
            'headers': {
                **cors_headers,
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                **cors_headers,
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
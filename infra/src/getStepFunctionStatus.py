import json
import boto3
import os
from botocore.exceptions import ClientError

def handler(event, context):
    """
    Lambda function to get the status of a Step Function execution
    
    Parameters:
    event (dict): API Gateway Lambda Proxy Input Format
    context (object): Lambda Context runtime methods and attributes
    
    Returns:
    dict: API Gateway Lambda Proxy Output Format
    """
    try:
        # Get the executionArn from query parameters
        execution_arn = event.get('queryStringParameters', {}).get('executionArn')
        
        if not execution_arn:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*'
                },
                'body': json.dumps({'error': 'executionArn is required'})
            }

        # Initialize AWS Step Functions client
        sfn_client = boto3.client('stepfunctions')
        
        # Get execution status
        response = sfn_client.describe_execution(
            executionArn=execution_arn
        )
        
        # Prepare the response
        status_response = {
            'status': response['status'],
            'startDate': response['startDate'].isoformat(),
            'stopDate': response['stopDate'].isoformat() if 'stopDate' in response else None,
            'output': json.loads(response['output']) if 'output' in response else None
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps(status_response)
        }
        
    except ClientError as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }
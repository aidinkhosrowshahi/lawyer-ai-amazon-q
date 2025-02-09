import json
import boto3
import os
import logging
from botocore.exceptions import ClientError

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

iot_client = boto3.client('iot-data')

def lambda_handler(event, context):
    try:
        # Parse SNS message
        logger.info("Processing incoming SNS event")
        sns_message = event['Records'][0]['Sns']
        message = sns_message['Message']
        
        # Log the incoming message details
        logger.info(f"Received SNS message with ID: {sns_message['MessageId']}")
        
        # Prepare payload
        payload = {
            'message': message,
            'messageId': sns_message['MessageId'],
            'timestamp': sns_message['Timestamp']
        }
        
        # Use exact topic name without any slashes
        iot_topic = "stepfunction/status"  # Hardcoded exact topic
        logger.info(f"Publishing to IoT topic: {iot_topic}")
        logger.info(f"Payload: {json.dumps(payload)}")
        
        # Publish to IoT Core topic
        response = iot_client.publish(
            topic=iot_topic,
            qos=1,
            payload=json.dumps(payload)
        )
        
        logger.info("Successfully published message to IoT Core")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Message published successfully',
                'messageId': sns_message['MessageId'],
                'topic': iot_topic
            })
        }
        
    except Exception as e:
        logger.error(f"Error publishing to IoT Core: {str(e)}")
        logger.exception("Full exception details:")
        raise
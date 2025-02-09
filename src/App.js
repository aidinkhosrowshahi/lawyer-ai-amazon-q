import { Table, Box } from "@cloudscape-design/components";
import { AWSIoTProvider } from '@aws-amplify/pubsub';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import {
    AppLayout,
    ContentLayout,
    SideNavigation,
    Header,
    SpaceBetween,
    Link,
    Button,
    Alert,
    ProgressBar,
    FormField,
    TokenGroup,
    Container,
    Input,
    TopNavigation
} from "@cloudscape-design/components";
import { Amplify, Auth, Storage, PubSub } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import awsconfig from './aws-exports';

Amplify.configure(awsconfig);

// Configure IoT Provider
const configureIoT = async () => {
    try {
        await Auth.currentSession(); // Ensure auth is ready
        const user = await Auth.currentAuthenticatedUser();
        const clientId = `${user.username}-${Date.now()}`;

        Amplify.addPluggable(new AWSIoTProvider({
            aws_pubsub_region: 'us-east-1',
            aws_pubsub_endpoint: 'wss://a2hsqzd0wqnyl5-ats.iot.us-east-1.amazonaws.com/mqtt',
            clientId: clientId
        }));
        console.log('IoT provider configured successfully');
        return true;
    } catch (error) {
        console.error('Error configuring IoT provider:', error);
        throw error;
    }
};


// Constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'text/plain',
];

// Utility functions
const formatBytes = (bytes, decimals = 2, k = 1024) => {
    if (bytes === 0) return "0 Bytes";
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
        return `File ${file.name} is too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}`;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return `File type ${file.type} is not allowed`;
    }
    return null;
};

const validateCaseId = (caseId) => {
    const caseIdRegex = /^[a-zA-Z0-9-_]+$/;
    if (!caseIdRegex.test(caseId)) {
        return 'Case ID can only contain letters, numbers, hyphens, and underscores';
    }
    return null;
};

// Navigation Component
const Navigation = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <SideNavigation
            activeHref={location.pathname}
            header={{ href: "/", text: "S3 File Uploader" }}
            items={[
                { type: "link", text: "Upload", href: "/" },
                { type: "divider" },
                {
                    type: "link",
                    text: "AWS Documentation",
                    href: "https://docs.aws.amazon.com",
                    external: true
                }
            ]}
        />
    );
};

const List = ({ list }) => (
    <>
        {list.map((item) => (
            <ProgressBar
                key={item.id}
                status={item.status}
                value={item.percentage}
                variant="standalone"
                additionalInfo={item.filesize}
                description={item.filetype}
                label={item.filename}
            />
        ))}
    </>
);

// Main Content Component
const MainContent = ({ signOut }) => {
    const hiddenFileInput = useRef(null);
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        type: 'error',
        message: '',
        header: ''
    });
    const [uploadList, setUploadList] = useState([]);
    const [fileList, setFileList] = useState([]);
    const [historyList, setHistoryList] = useState([]);
    const [caseId, setCaseId] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [iotMessages, setIotMessages] = useState([]);

    // Add connection status state
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');

    const [isReconnecting, setIsReconnecting] = useState(false);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // IoT subscription
    useEffect(() => {
        let subscription;
        
        const setupIoTMessaging = async () => {
            try {
                if (reconnectAttempts.current >= maxReconnectAttempts) {
                    setConnectionStatus('Failed');
                    return;
                }
        
                await configureIoT();
                console.log('Setting up IoT subscription...');
                
                setConnectionStatus('Connecting...');
                
                subscription = PubSub.subscribe('stepfunction/status').subscribe({
                    next: (data) => {
                        console.log('Raw message received:', JSON.stringify(data, null, 2));
                        reconnectAttempts.current = 0; // Reset on successful message
                        
                        let messageContent;
                        if (data.value && typeof data.value === 'object') {
                            messageContent = data.value.message || data.value;
                        } else {
                            messageContent = data;
                        }
                        
                        const newMessage = {
                            timestamp: new Date().toISOString(),
                            message: typeof messageContent === 'string' ? 
                                messageContent : 
                                messageContent.message || 'Message received',
                            priority: messageContent.priority || 'info',
                            messageId: messageContent.messageId || `msg-${Date.now()}`
                        };
                        
                        console.log('Processed message:', newMessage);
                        
                        setIotMessages(prevMessages => [newMessage, ...prevMessages].slice(0, 100));
                        setConnectionStatus('Connected');
                        setIsReconnecting(false);
                    },
                    error: async (error) => {
                        console.error('Subscription error:', error);
                        setConnectionStatus('Error');
                        
                        // Attempt to reconnect
                        reconnectAttempts.current += 1;
                        setIsReconnecting(true);
                        
                        // Wait before attempting to reconnect
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        setupIoTMessaging();
                    },
                    complete: () => {
                        console.log('Subscription completed');
                        setConnectionStatus('Disconnected');
                    }
                });
                
                // Send test message
                await PubSub.publish('stepfunction/status', {
                    message: 'Connection test message',
                    priority: 'info',
                    messageId: `test-${Date.now()}`
                });
                
            } catch (error) {
                console.error('Error in IoT setup:', error);
                setConnectionStatus('Error');
                
                // Attempt to reconnect
                reconnectAttempts.current += 1;
                setIsReconnecting(true);
                
                // Wait before attempting to reconnect
                await new Promise(resolve => setTimeout(resolve, 2000));
                setupIoTMessaging();
            }
        };
        
        setupIoTMessaging();
        
        return () => {
            if (subscription) {
                subscription.unsubscribe();
                setConnectionStatus('Disconnected');
            }
        };
    }, []);
    const showAlert = (type, message, header) => {
        setAlertConfig({
            visible: true,
            type,
            message,
            header
        });
    };

    const getCurrentUser = async () => {
        try {
            const user = await Auth.currentAuthenticatedUser();
            return {
                username: user.username,
                email: user.attributes.email,
                sub: user.attributes.sub
            };
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    };

    const handleClick = () => {
        hiddenFileInput.current.value = "";
        hiddenFileInput.current.click();
    };

    const handleChange = (e) => {
        e.preventDefault();
        const files = Array.from(e.target.files);
        
        const errors = files.map(file => validateFile(file)).filter(error => error !== null);
        if (errors.length > 0) {
            showAlert('error', errors.join('\n'), 'File Validation Error');
            return;
        }

        const tempUploadList = files.map((file, index) => ({
            label: file.name,
            labelTag: formatBytes(file.size),
            description: 'File type: ' + file.type,
            icon: 'file',
            id: index
        }));

        setUploadList(tempUploadList);
        setFileList(files);
    };

    const progressBarFactory = useCallback((fileObject) => {
        const newHistoryItem = {
            id: Date.now(),
            percentage: 0,
            filename: fileObject.name,
            filetype: fileObject.type,
            filesize: formatBytes(fileObject.size),
            status: 'in-progress'
        };
        
        setHistoryList(prevList => [...prevList, newHistoryItem]);
        
        return (progress) => {
            setHistoryList(prevList => {
                const newList = [...prevList];
                const index = newList.findIndex(item => item.id === newHistoryItem.id);
                if (index !== -1) {
                    const percentage = Math.round((progress.loaded / progress.total) * 100);
                    newList[index] = {
                        ...newList[index],
                        percentage,
                        status: percentage === 100 ? 'success' : 'in-progress'
                    };
                }
                return newList;
            });
        };
    }, []);

    const handleUpload = async () => {
        if (uploadList.length === 0) {
            showAlert('error', 'You must select the files that you want to upload.', 'Error');
            return;
        }

        const caseIdError = validateCaseId(caseId);
        if (caseIdError) {
            showAlert('error', caseIdError, 'Validation Error');
            return;
        }

        try {
            setIsUploading(true);
            const userInfo = await getCurrentUser();
            if (!userInfo) {
                showAlert('error', 'Unable to get user information.', 'Authentication Error');
                return;
            }

            const uploadPromises = uploadList.map(async (item) => {
                const file = fileList[item.id];
                const progressBar = progressBarFactory(file);
                const s3Key = `data/${caseId}/${file.name}`;

                return Storage.put(s3Key, file, {
                    progressCallback: progressBar,
                    level: "protected",
                    metadata: {
                        userid: userInfo.sub,
                        username: userInfo.username,
                        useremail: userInfo.email,
                        caseid: caseId,
                        uploaddate: new Date().toISOString(),
                        filename: file.name,
                        filetype: file.type,
                        filesize: file.size.toString()
                    }
                });
            });

            await Promise.all(uploadPromises);
            setUploadList([]);
            showAlert('success', 'Files uploaded successfully!', 'Success');

        } catch (error) {
            console.error('Upload error:', error);
            showAlert('error', 'An error occurred while uploading files. Please try again.', 'Error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDismiss = useCallback((itemIndex) => {
        setUploadList(prevList => [
            ...prevList.slice(0, itemIndex),
            ...prevList.slice(itemIndex + 1)
        ]);
    }, []);

    // Table column definitions
    const columnDefinitions = [
        {
            id: "timestamp",
            header: "Timestamp",
            cell: item => new Date(item.timestamp).toLocaleString(),
            sortingField: "timestamp"
        },
        {
            id: "message",
            header: "Message",
            cell: item => item.message
        },
        {
            id: "priority",
            header: "Priority",
            cell: item => item.priority
        },
        {
            id: "messageId",
            header: "Message ID",
            cell: item => item.messageId
        }
    ];

    return (
        <>
            <TopNavigation
                identity={{
                    href: "#",
                    title: "S3 File Uploader"
                }}
                utilities={[
                    {
                        type: "button",
                        text: "Sign out",
                        onClick: signOut
                    }
                ]}
            />
            <ContentLayout
                header={
                    <SpaceBetween size="m">
                        <Header
                            variant="h1"
                            description="Upload files to Amazon S3"
                        >
                            File Upload
                        </Header>
                    </SpaceBetween>
                }
            >
                <SpaceBetween size="l">
                    <Container
                        header={
                            <Header variant="h2">
                                Upload multiple objects to S3
                            </Header>
                        }
                    >
                        <div>
                            {alertConfig.visible && (
                                <Alert
                                    onDismiss={() => setAlertConfig(prev => ({...prev, visible: false}))}
                                    dismissAriaLabel="Close alert"
                                    dismissible
                                    type={alertConfig.type}
                                    header={alertConfig.header}
                                >
                                    {alertConfig.message}
                                </Alert>
                            )}

                            <FormField
                                label='Case ID'
                                description='Enter the Case ID for this upload (letters, numbers, hyphens, and underscores only)'
                            >
                                <Input
                                    value={caseId}
                                    onChange={({ detail }) => setCaseId(detail.value)}
                                    placeholder="Enter Case ID"
                                    disabled={isUploading}
                                />
                            </FormField>

                            <FormField
                                label='Object Upload'
                                description={`Select files to upload (Max size: ${formatBytes(MAX_FILE_SIZE)})`}
                            >
                                <SpaceBetween direction="horizontal" size="xs">
                                    <Button 
                                        onClick={handleClick}
                                        disabled={isUploading}
                                    >
                                        Open
                                    </Button>
                                    <input
                                        type="file"
                                        ref={hiddenFileInput}
                                        onChange={handleChange}
                                        style={{display: 'none'}}
                                        multiple
                                    />
                                    <Button 
                                        onClick={handleUpload}
                                        loading={isUploading}
                                        disabled={isUploading || uploadList.length === 0}
                                    >
                                        Upload
                                    </Button>
                                </SpaceBetween>
                            </FormField>

                            <TokenGroup
                                onDismiss={handleDismiss}
                                items={uploadList}
                            />

                            {historyList.length > 0 && (
                                <FormField label="Upload progress">
                                    <List list={historyList}/>
                                </FormField>
                            )}
                        </div>
                    </Container>
                    <Container
                        header={
                            <Header variant="h2">
                                IoT Messages (Status: {connectionStatus})
                            </Header>
                        }
                    >
                        <Table
                            columnDefinitions={columnDefinitions}
                            items={iotMessages}
                            loading={false}
                            loadingText="Loading messages"
                            sortingDisabled
                            empty={
                                <Box textAlign="center" color="inherit">
                                    <b>No messages</b>
                                    <Box padding={{ bottom: "s" }}>
                                        {connectionStatus === 'Connected' 
                                            ? 'Waiting for new messages...' 
                                            : `Connection status: ${connectionStatus}`
                                        }
                                    </Box>
                                </Box>
                            }
                            header={
                                <Header
                                    counter={`(${iotMessages.length})`}
                                    info={
                                        <Box 
                                            color={
                                                connectionStatus === 'Connected' ? 'green' :
                                                connectionStatus === 'Connecting...' ? 'blue' :
                                                'red'
                                            }
                                        >
                                            {connectionStatus}
                                            {isReconnecting && ' (Reconnecting...)'}
                                            {connectionStatus === 'Failed' && ' (Max attempts reached)'}
                                        </Box>
                                    }
                                >
                                    StepFunction Status Messages
                                </Header>
                            }
                        />
                    </Container>                   
                    <Container
                        header={
                            <Header variant="h2">
                                Amazon Q Assistant
                            </Header>
                        }
                    >
                        <iframe 
                            src="https://d9x46exb.chat.qbusiness.us-east-1.on.aws/"
                            style={{
                                minWidth: "450px",
                                width: "100%",
                                height: "650px",
                                border: "none"
                            }}
                            title="Amazon Q Assistant"
                        />
                    </Container>
                    
                </SpaceBetween>
                
            </ContentLayout>
        </>
    );
};

// Main App Component
const App = ({ signOut, user }) => {
    return (
        <AppLayout
            navigation={<Navigation />}
            content={<MainContent signOut={signOut} />}
            toolsHide={true}
            navigationWidth={290}
        />
    );
};

// Export with authentication wrapper
export default withAuthenticator(App, {
    signUpAttributes: ['email'],
    hideSignUp: false
});

import React, { useState, useRef, useCallback } from 'react';
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
import { Amplify, Auth, Storage } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import awsconfig from './aws-exports';

Amplify.configure(awsconfig);

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

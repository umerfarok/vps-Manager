"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Button, Paper, List, ListItem, ListItemText,
    IconButton, Tooltip, TextField, AppBar, Toolbar, Drawer,
    ListItemIcon, Divider, CircularProgress, LinearProgress
} from '@mui/material';
import {
    Terminal as TerminalIcon, ContentCopy, Clear, Code,
    Info, Settings, Refresh, Send, Memory, Storage
} from '@mui/icons-material';
import axios from 'axios';
import { useUser } from '@/UserContext';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';


SyntaxHighlighter.registerLanguage('bash', bash);

const VPSManager = () => {
    const [command, setCommand] = useState('');
    const [output, setOutput] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [serverInfo, setServerInfo] = useState(null);
    const outputRef = useRef(null);
    const { userId } = useUser();

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        fetchSuggestions();
        fetchServerInfo();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const response = await axios.get('/api/terminal', { headers: { 'x-user-id': userId } });
            setSuggestions(response.data.suggestions);
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
            toast.error('Failed to fetch command suggestions');
        }
    };

    const fetchServerInfo = async () => {
        try {
            const response = await axios.get('/api/terminal?info=server', { headers: { 'x-user-id': userId } });
            setServerInfo(response.data);
        } catch (error) {
            console.error('Failed to fetch server info:', error);
            toast.error('Failed to fetch server information');
        }
    };

    const handleCommandSubmit = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        setOutput(prev => [...prev, { type: 'command', content: command }]);
        setHistory(prev => [command, ...prev]);
        setHistoryIndex(-1);
        setCommand('');
        setIsLoading(true);

        try {
            const response = await axios.post('/api/terminal', { command }, { headers: { 'x-user-id': userId } });
            if (response.data.output) {
                setOutput(prev => [...prev, { type: 'output', content: response.data.output }]);
            }
            if (response.data.error) {
                setOutput(prev => [...prev, { type: 'error', content: response.data.error }]);
            }
        } catch (error) {
            console.error('Failed to execute command:', error);
            setOutput(prev => [...prev, { type: 'error', content: 'Failed to execute command: ' + error.message }]);
            toast.error('Failed to execute command');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setCommand(suggestion);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHistoryIndex(prevIndex => {
                const newIndex = Math.min(prevIndex + 1, history.length - 1);
                setCommand(history[newIndex] || '');
                return newIndex;
            });
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHistoryIndex(prevIndex => {
                const newIndex = Math.max(prevIndex - 1, -1);
                setCommand(history[newIndex] || '');
                return newIndex;
            });
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Copied to clipboard');
        }, (err) => {
            console.error('Failed to copy: ', err);
            toast.error('Failed to copy to clipboard');
        });
    };

    const clearTerminal = () => {
        setOutput([]);
        toast.info('Terminal cleared');
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        sx={{ mr: 2 }}
                    >
                        <Code />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        VPS Manager
                    </Typography>
                    <Tooltip title="Refresh Server Info">
                        <IconButton color="inherit" onClick={fetchServerInfo}>
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>
            <Drawer
                variant="permanent"
                sx={{
                    width: 240,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
                }}
                open={isDrawerOpen}
            >
                <Toolbar />
                <Box sx={{ overflow: 'auto' }}>
                    <List>
                        <ListItem button onClick={() => setIsDrawerOpen(false)}>
                            <ListItemIcon>
                                <TerminalIcon />
                            </ListItemIcon>
                            <ListItemText primary="Terminal" />
                        </ListItem>
                        <ListItem button onClick={() => toast.info('Server Info feature coming soon!')}>
                            <ListItemIcon>
                                <Info />
                            </ListItemIcon>
                            <ListItemText primary="Server Info" />
                        </ListItem>
                        <ListItem button onClick={() => toast.info('Settings feature coming soon!')}>
                            <ListItemIcon>
                                <Settings />
                            </ListItemIcon>
                            <ListItemText primary="Settings" />
                        </ListItem>
                    </List>
                    <Divider />
                    <List>
                        <ListItem>
                            <ListItemText
                                primary="Server Status"
                                secondary={serverInfo ? `${serverInfo.status}` : 'Loading...'}
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="IP Address"
                                secondary={serverInfo ? `${serverInfo.ip}` : 'Loading...'}
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <Memory />
                            </ListItemIcon>
                            <ListItemText
                                primary="CPU Usage"
                                secondary={
                                    serverInfo ? (
                                        <LinearProgress
                                            variant="determinate"
                                            value={parseInt(serverInfo.cpu)}
                                            sx={{ mt: 1 }}
                                        />
                                    ) : 'Loading...'
                                }
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <Storage />
                            </ListItemIcon>
                            <ListItemText
                                primary="Memory Usage"
                                secondary={
                                    serverInfo ? (
                                        <LinearProgress
                                            variant="determinate"
                                            value={parseInt(serverInfo.memory)}
                                            sx={{ mt: 1 }}
                                        />
                                    ) : 'Loading...'
                                }
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <Storage />
                            </ListItemIcon>
                            <ListItemText
                                primary="Disk Usage"
                                secondary={
                                    serverInfo ? (
                                        <LinearProgress
                                            variant="determinate"
                                            value={parseInt(serverInfo.disk)}
                                            sx={{ mt: 1 }}
                                        />
                                    ) : 'Loading...'
                                }
                            />
                        </ListItem>
                    </List>
                </Box>
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                <Toolbar />
                <Paper
                    ref={outputRef}
                    elevation={3}
                    sx={{
                        height: 'calc(100vh - 200px)',
                        mb: 2,
                        p: 2,
                        overflowY: 'auto',
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                        fontFamily: 'monospace',
                        '&::-webkit-scrollbar': {
                            width: '0.4em'
                        },
                        '&::-webkit-scrollbar-track': {
                            boxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
                            webkitBoxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)'
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(0,0,0,.1)',
                            outline: '1px solid slategrey'
                        }
                    }}
                >
                    {output.map((item, index) => (
                        <Box key={index} sx={{ mb: 1, position: 'relative' }}>
                            {item.type === 'command' && (
                                <SyntaxHighlighter language="bash" style={atomOneDark} customStyle={{ background: 'transparent', padding: 0 }}>
                                    {`$ ${item.content}`}
                                </SyntaxHighlighter>
                            )}
                            {item.type === 'output' && (
                                <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {item.content}
                                </Typography>
                            )}
                            {item.type === 'error' && (
                                <Typography sx={{ color: '#f44336', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {item.content}
                                </Typography>
                            )}
                            <Tooltip title="Copy to Clipboard">
                                <IconButton
                                    onClick={() => copyToClipboard(item.content)}
                                    sx={{ position: 'absolute', top: 0, right: 0, color: '#d4d4d4' }}
                                >
                                    <ContentCopy fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                    {isLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <CircularProgress />
                        </Box>
                    )}
                </Paper>
                <form onSubmit={handleCommandSubmit} style={{ display: 'flex', marginBottom: '1rem' }}>
                    <TextField
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        variant="outlined"
                        fullWidth
                        placeholder="Enter command..."
                        InputProps={{
                            style: {
                                fontFamily: 'monospace',
                                backgroundColor: '#2c2c2c',
                                color: '#d4d4d4',
                            }
                        }}
                        sx={{ mr: 1 }}
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading}
                        endIcon={<Send />}
                        sx={{ bgcolor: '#0078d4', '&:hover': { bgcolor: '#106ebe' } }}
                    >
                        Execute
                    </Button>
                </form>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ color: '#d4d4d4' }}>Suggested Commands:</Typography>
                    <Tooltip title="Clear Terminal">
                        <IconButton onClick={clearTerminal} sx={{ color: '#d4d4d4' }}>
                            <Clear />
                        </IconButton>
                    </Tooltip>
                </Box>
                <List sx={{ bgcolor: '#2c2c2c', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    {suggestions.map((suggestion, index) => (
                        <ListItem key={index} button onClick={() => handleSuggestionClick(suggestion.command)} sx={{ '&:hover': { bgcolor: '#3c3c3c' } }}>
                            <ListItemText
                                primary={suggestion.command}
                                secondary={suggestion.description}
                                primaryTypographyProps={{ color: '#d4d4d4' }}
                                secondaryTypographyProps={{ color: '#a0a0a0' }}
                            />
                        </ListItem>
                    ))}
                </List>
            </Box>
            <ToastContainer position="bottom-right" theme="dark" />
        </Box>
    );
};

export default VPSManager;
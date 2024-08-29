import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, AppBar, Toolbar, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, Divider, LinearProgress } from '@mui/material';
import { Code, Refresh, Info, Settings, Memory, Storage } from '@mui/icons-material';
import axios from 'axios';
import { useUser } from '@/UserContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';

const Terminal = dynamic(() => import('xterm').then((mod) => mod.Terminal), { ssr: false });
const FitAddon = dynamic(() => import('xterm-addon-fit').then((mod) => mod.FitAddon), { ssr: false });
const WebLinksAddon = dynamic(() => import('xterm-addon-web-links').then((mod) => mod.WebLinksAddon), { ssr: false });

const VPSManager = () => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [serverInfo, setServerInfo] = useState(null);
    const [currentDirectory, setCurrentDirectory] = useState('/home/user');
    const { userId } = useUser();
    const terminalRef = useRef(null);
    const terminalInstance = useRef(null);
    const fitAddon = useRef(null);
    const currentLineBuffer = useRef('');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const timer = setTimeout(() => {
            initializeTerminal();
        }, 100);

        fetchServerInfo();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (terminalInstance.current) {
                terminalInstance.current.dispose();
            }
            clearTimeout(timer);
        };
    }, []);

    const initializeTerminal = () => {
        if (terminalRef.current && !terminalInstance.current) {
            terminalInstance.current = new Terminal({
                cursorBlink: true,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: 14,
                theme: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                },
            });

            fitAddon.current = new FitAddon();
            terminalInstance.current.loadAddon(fitAddon.current);
            terminalInstance.current.loadAddon(new WebLinksAddon());

            terminalInstance.current.open(terminalRef.current);
            fitAddon.current.fit();

            terminalInstance.current.writeln('Welcome to VPS Manager Terminal');
            terminalInstance.current.writeln('Type "help" for a list of available commands');
            promptUser();

            terminalInstance.current.onKey(handleKeyPress);
            terminalInstance.current.onData(handleTerminalData);
        }
    };

    const handleResize = () => {
        if (fitAddon.current) {
            fitAddon.current.fit();
        }
    };

    const fetchServerInfo = async () => {
        try {
            const response = await axios.get('/api/terminal?info=server', {
                headers: { 'x-user-id': userId },
                timeout: 5000
            });
            setServerInfo(response.data);
        } catch (error) {
            console.error('Failed to fetch server info:', error);
            toast.error('Failed to fetch server information');
        }
    };

    const promptUser = () => {
        terminalInstance.current.write(`\r\n\x1b[32muser@vps\x1b[0m:\x1b[34m${currentDirectory}\x1b[0m$ `);
    };

    const handleKeyPress = (e) => {
        const printable = !e.domEvent.altKey && !e.domEvent.ctrlKey && !e.domEvent.metaKey;

        if (e.domEvent.keyCode === 13) { // Enter key
            const command = currentLineBuffer.current.trim();
            currentLineBuffer.current = '';
            handleCommand(command);
        } else if (e.domEvent.keyCode === 9) { // Tab key
            e.domEvent.preventDefault();
            handleTabCompletion();
        }
    };

    const handleTerminalData = (data) => {
        const ord = data.charCodeAt(0);
        if (ord < 32 || ord === 127) { // Control characters
            switch (data) {
                case '\u0003': // Ctrl+C
                    terminalInstance.current.write('^C');
                    promptUser();
                    currentLineBuffer.current = '';
                    break;
                case '\u007F': // Backspace
                    if (currentLineBuffer.current.length > 0) {
                        currentLineBuffer.current = currentLineBuffer.current.slice(0, -1);
                        terminalInstance.current.write('\b \b');
                    }
                    break;
            }
        } else {
            currentLineBuffer.current += data;
            terminalInstance.current.write(data);
        }
    };

    const handleCommand = async (command) => {
        terminalInstance.current.writeln('');
        if (command === '') {
            promptUser();
            return;
        }

        if (command === 'help') {
            displayHelp();
        } else if (command.startsWith('cd ')) {
            await changeDirectory(command.split(' ')[1]);
        } else {
            try {
                const response = await axios.post('/api/terminal', { command, currentDirectory }, {
                    headers: { 'x-user-id': userId },
                    timeout: 10000
                });
                if (response.data.output) {
                    terminalInstance.current.writeln(response.data.output);
                }
                if (response.data.newDirectory) {
                    setCurrentDirectory(response.data.newDirectory);
                }
            } catch (error) {
                console.error('Failed to execute command:', error);
                terminalInstance.current.writeln(`\x1b[31mError: ${error.message}\x1b[0m`);
            }
        }
        promptUser();
    };

    const handleTabCompletion = async () => {
        try {
            const response = await axios.get('/api/terminal', {
                params: {
                    command: currentLineBuffer.current,
                    currentDirectory: currentDirectory
                },
                headers: { 'x-user-id': userId },
                timeout: 5000
            });

            if (response.data.completions.length === 1) {
                const completion = response.data.completions[0];
                const toComplete = completion.slice(currentLineBuffer.current.length);
                terminalInstance.current.write(toComplete);
                currentLineBuffer.current += toComplete;
            } else if (response.data.completions.length > 1) {
                terminalInstance.current.writeln('');
                terminalInstance.current.writeln(response.data.completions.join('  '));
                promptUser();
                terminalInstance.current.write(currentLineBuffer.current);
            }
        } catch (error) {
            console.error('Failed to get completions:', error);
        }
    };

    const changeDirectory = async (newDir) => {
        try {
            const response = await axios.post('/api/terminal', { command: `cd ${newDir} && pwd`, currentDirectory }, {
                headers: { 'x-user-id': userId },
                timeout: 5000
            });
            if (response.data.newDirectory) {
                setCurrentDirectory(response.data.newDirectory);
            } else {
                terminalInstance.current.writeln(`cd: ${newDir}: No such file or directory`);
            }
        } catch (error) {
            console.error('Failed to change directory:', error);
            terminalInstance.current.writeln(`\x1b[31mError: ${error.message}\x1b[0m`);
        }
    };

    const displayHelp = () => {
        const helpText = `
    Available commands:
      cd <directory>  - Change directory
      ls              - List files in the current directory
      pwd             - Print working directory
      help            - Display this help message
      clear           - Clear the terminal screen
    
    Use Tab for command and path completion.
        `;
        terminalInstance.current.writeln(helpText);
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
                    <IconButton color="inherit" onClick={fetchServerInfo}>
                        <Refresh />
                    </IconButton>
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
                                <Code />
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
                    elevation={3}
                    sx={{
                        height: 'calc(100vh - 100px)',
                        bgcolor: '#1e1e1e',
                        color: '#d4d4d4',
                        overflow: 'hidden',
                    }}
                >
                    {isClient && <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />}
                </Paper>
            </Box>
            <ToastContainer position="bottom-right" theme="dark" />
        </Box>
    );
};

export default VPSManager;
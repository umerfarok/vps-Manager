import { createTheme, ThemeProvider } from '@mui/material/styles';
import { UserProvider } from '../UserContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5', // A more subtle blue color
    },
    background: {
      default: '#f5f5f5', // Light grey background
      paper: '#ffffff', // White background for cards and papers
    },
  },
  typography: {
    h3: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <UserProvider>
      <Component {...pageProps} />
      </UserProvider>
    </ThemeProvider>
  );
}

export default MyApp;
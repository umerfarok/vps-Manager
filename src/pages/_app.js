import { UserProvider } from '../UserContext';
import { ThemeProviderWrapper } from '../ThemeContext';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>VPS Manager Pro</title>
        <meta name="description" content="Professional VPS Management Made Simple" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <ThemeProviderWrapper>
        <UserProvider>
          <Component {...pageProps} />
        </UserProvider>
      </ThemeProviderWrapper>
    </>
  );
}

export default MyApp;
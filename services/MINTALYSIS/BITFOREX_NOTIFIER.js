import Twitter from 'twitter-lite';
import fetch from 'node-fetch';

const client = new Twitter({
    consumer_key: "9opqsNm6yPFWLioa4NPnKQ7TF",
    consumer_secret: "POJm0rHAYP0KWuLlADkf3Kelrg977IvrTAiyS7Ht2zrzLxRIwp",
    access_token_key: "1365263486360694788-JqUPOACVQlEY8nOMYpH11uSsKRuWw3",
    access_token_secret: "vJVSSNJuqibSyuApz2d9aps3iNh2O7r24agzhjyOfVVCT"
});

export const bitforexNotifier = async () => {
    const intervalId = setInterval(checkWebsiteStatus, 30000);

    console.log('[BITFOREX NOTIFIER] - [STARTED]');

    async function checkWebsiteStatus() {
        console.log('RUNNING')
        try {
            const response = await fetch(`https://api.uptimerobot.com/v2/getMonitors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `api_key=u2475106-06144815bfaebfb126de605c&format=json&monitors=796442214`
            });

            const data = await response.json();

            const StatusToTweet = `
🚨BREAKING🚨

$OMI holders and speculators - Our system has indicated that BitForex is back online.

https://bitforex.com

@ecomi_ @veve_official @omi_the_clown @rootlessgirl @omidailyburn
`;

            if (data && data.monitors && data.monitors[0].status === 2) { // Status 2 means the website is up
                client.post('statuses/update', {status: StatusToTweet})
                    .then(tweet => {
                        console.log('Tweeted', tweet);
                        clearInterval(intervalId);
                    })
                    .catch(error => {
                        console.error('Error', error);
                    });
            }
        } catch (error) {
            console.error('Failed to check website status:', error);
        }
    }
};


#!/usr/bin/env python2

import pickle
import gdata.gauth
from config import CLI_OAUTH2_ID, CLI_OAUTH2_SECRET

token = gdata.gauth.OAuth2Token(client_id=CLI_OAUTH2_ID,
                                client_secret=CLI_OAUTH2_SECRET,
                                scope='https://spreadsheets.google.com/feeds/',
                                user_agent='Lensing')

print "Go to the following URL, copy the code there, and paste it here\n"
print token.generate_authorize_url(redirect_uri='urn:ietf:wg:oauth:2.0:oob')
code = raw_input("\nWhat is the verification code? ").strip()

with open('google_token.txt', 'w') as f:
    pickle.dump(token, f)

print "The token has been saved to 'google_token.txt'"

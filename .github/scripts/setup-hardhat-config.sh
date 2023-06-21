#!/bin/sh
MAINNET_URL="$1"
POLYGON_URL="$2"
OPTIMISM_URL="$3"
ARBITRUM_URL="$4"
GNOSIS_URL="$5"
BSC_URL="$6"
FANTOM_URL="$7"
AVALANCHE_URL="$8"

set -o errexit

mkdir -p $HOME/.hardhat

echo "
{
  \"networks\": {
    \"mainnet\": { \"url\": \"${MAINNET_URL}\" },
    \"polygon\": { \"url\": \"${POLYGON_URL}\" },
    \"optimism\": { \"url\": \"${OPTIMISM_URL}\" },
    \"arbitrum\": { \"url\": \"${ARBITRUM_URL}\" },
    \"gnosis\": { \"url\": \"${GNOSIS_URL}\" },
    \"bsc\": { \"url\": \"${BSC_URL}\" },
    \"fantom\": { \"url\": \"${FANTOM_URL}\" },
    \"avalanche\": { \"url\": \"${AVALANCHE_URL}\" }
  }
}
" > $HOME/.hardhat/networks.mimic.json

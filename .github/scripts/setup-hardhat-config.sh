#!/bin/sh
MAINNET_URL="$1"
POLYGON_URL="$2"
OPTIMISM_URL="$3"
ARBITRUM_URL="$4"
GNOSIS_URL="$5"
AVALANCHE_URL="$6"
BSC_URL="$7"
FANTOM_URL="$8"
ZKEVM_URL="$9"
BASE_URL="${10}"

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
    \"avalanche\": { \"url\": \"${AVALANCHE_URL}\" },
    \"bsc\": { \"url\": \"${BSC_URL}\" },
    \"fantom\": { \"url\": \"${FANTOM_URL}\" },
    \"zkevm\": { \"url\": \"${ZKEVM_URL}\" },
    \"base\": { \"url\": \"${BASE_URL}\" }
  }
}
" > $HOME/.hardhat/networks.mimic.json

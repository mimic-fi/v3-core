// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/math/SafeCast.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import '@mimic-fi/v3-authorizer/contracts/Authorized.sol';
import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';

import './interfaces/IPriceOracle.sol';

/**
 * @title OnChainOracle
 * @dev Price oracle mixing both on-chain and off-chain oracle alternatives
 *
 * The on-chain oracle that interfaces with Chainlink feeds to provide rates between two tokens. This oracle only
 * operates with ERC20 tokens, it does not allow querying quotes for any other denomination. Additionally, it only
 * supports feeds that implement ChainLink's proposed `AggregatorV3Interface` interface.
 *
 *  The off-chain oracle that uses off-chain signatures to compute prices between two tokens
 */
contract PriceOracle is IPriceOracle, Authorized, ReentrancyGuardUpgradeable {
    using FixedPoint for uint256;
    using UncheckedMath for uint256;
    using BytesHelpers for bytes;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Number of decimals used for fixed point operations: 18
    uint256 private constant FP_DECIMALS = 18;

    // Maximum number of decimals supported for a token when computing inverse quotes: 36
    uint256 private constant INVERSE_FEED_MAX_DECIMALS = 36;

    // It allows denoting a single token to pivot between feeds in case a direct path is not available
    address public pivot;

    // Mapping of feeds from "token A" to "token B"
    mapping (address => mapping (address => address)) public override getFeed;

    // Enumerable set of trusted signers
    EnumerableSet.AddressSet private _signers;

    /**
     * @dev Feed data, only used during initialization
     * @param base Token to rate
     * @param quote Token used for the price rate
     * @param feed Chainlink oracle to fetch the given pair price
     */
    struct FeedData {
        address base;
        address quote;
        address feed;
    }

    /**
     * @dev Price data
     * @param base Token to rate
     * @param quote Token used for the price rate
     * @param rate Price of a token (base) expressed in `quote`
     * @param deadline Expiration timestamp until when the given quote is considered valid
     */
    struct PriceData {
        address base;
        address quote;
        uint256 rate;
        uint256 deadline;
    }

    /**
     * @dev Initializes the price oracle.
     * Note this function can only be called from a function marked with the `initializer` modifier.
     * @param _authorizer Address of the authorizer to be set
     * @param _signer Address of the initial allowed signer
     * @param _pivot Address of the token to be used as the pivot
     * @param _feeds List of feeds to be initialized with
     */
    function initialize(address _authorizer, address _signer, address _pivot, FeedData[] memory _feeds)
        external
        initializer
    {
        __ReentrancyGuard_init();
        _initialize(_authorizer);
        _setSigner(_signer, true);
        pivot = _pivot;
        for (uint256 i = 0; i < _feeds.length; i++) _setFeed(_feeds[i].base, _feeds[i].quote, _feeds[i].feed);
    }

    /**
     * @dev Tells whether an address is as an allowed signer or not
     * @param signer Address of the signer being queried
     */
    function isSignerAllowed(address signer) public view override returns (bool) {
        return _signers.contains(signer);
    }

    /**
     * @dev Tells the list of allowed signers
     */
    function getAllowedSigners() external view override returns (address[] memory) {
        return _signers.values();
    }

    /**
     * @dev Tells the price of a token (base) in a given quote. The response is expressed using the corresponding
     * number of decimals so that when performing a fixed point product of it by a `base` amount it results in
     * a value expressed in `quote` decimals.
     * @param base Token to rate
     * @param quote Token used for the price rate
     */
    function getPrice(address base, address quote) public view override returns (uint256) {
        if (base == quote) return FixedPoint.ONE;

        // If `base * result / 1e18` must be expressed in `quote` decimals, then
        uint256 baseDecimals = IERC20Metadata(base).decimals();
        uint256 quoteDecimals = IERC20Metadata(quote).decimals();

        // No need for checked math as an uint8 + FP_DECIMALS (constant) will always fit in an uint256
        require(baseDecimals <= quoteDecimals.uncheckedAdd(FP_DECIMALS), 'BASE_DECIMALS_TOO_BIG');

        // No need for checked math as we are checking it manually beforehand
        uint256 resultDecimals = quoteDecimals.uncheckedAdd(FP_DECIMALS).uncheckedSub(baseDecimals);
        (uint256 price, uint256 decimals) = _getPrice(base, quote);
        return _scalePrice(price, decimals, resultDecimals);
    }

    /**
     /**
     * @dev Tries fetching a price for base/quote pair from an external encoded data. It fall-backs using the on-chain
     * oracle in case the require price is missing. It reverts in case the off-chain data verification fails.
     * @param base Token to rate
     * @param quote Token used for the price rate
     * @param data Encoded prices data along with its corresponding signature
     */
    function getPrice(address base, address quote, bytes memory data) external view override returns (uint256) {
        if (base == quote) return FixedPoint.ONE;

        PriceData[] memory prices = _decodePricesData(data);
        for (uint256 i = 0; i < prices.length; i++) {
            PriceData memory price = prices[i];
            if (price.base == base && price.quote == quote) {
                require(price.deadline >= block.timestamp, 'ORACLE_PRICE_OUTDATED');
                return price.rate;
            }
        }

        return getPrice(base, quote);
    }

    /**
     * @dev Sets a signer condition
     * @param signer Address of the signer to be set
     * @param allowed Whether the requested signer is allowed
     */
    function setSigner(address signer, bool allowed) external override nonReentrant authP(authParams(signer, allowed)) {
        _setSigner(signer, allowed);
    }

    /**
     * @dev Sets a feed for a (base, quote) pair. Sender must be authorized.
     * @param base Token base to be set
     * @param quote Token quote to be set
     * @param feed Feed to be set
     */
    function setFeed(address base, address quote, address feed)
        external
        override
        nonReentrant
        authP(authParams(base, quote, feed))
    {
        _setFeed(base, quote, feed);
    }

    /**
     * @dev Tells the price of a token (base) in a given quote.
     * @param base Token to rate
     * @param quote Token used for the price rate
     * @return price Requested price rate
     * @return decimals Decimals of the requested price rate
     */
    function _getPrice(address base, address quote) internal view returns (uint256 price, uint256 decimals) {
        address feed = getFeed[base][quote];
        if (feed != address(0)) return _getFeedData(feed);

        address inverseFeed = getFeed[quote][base];
        if (inverseFeed != address(0)) return _getInversePrice(inverseFeed);

        address baseFeed = getFeed[base][pivot];
        address quoteFeed = getFeed[quote][pivot];
        if (baseFeed != address(0) && quoteFeed != address(0)) return _getPivotPrice(baseFeed, quoteFeed);

        revert('ORACLE_MISSING_FEED');
    }

    /**
     * @dev Fetches data from a Chainlink feed
     * @param feed Address of the Chainlink feed to fetch data from. It must support ChainLink `AggregatorV3Interface`.
     * @return price Requested price
     * @return decimals Decimals of the requested price
     */
    function _getFeedData(address feed) internal view returns (uint256 price, uint256 decimals) {
        decimals = AggregatorV3Interface(feed).decimals();
        (, int256 priceInt, , , ) = AggregatorV3Interface(feed).latestRoundData();
        price = SafeCast.toUint256(priceInt);
    }

    /**
     * @dev Tells a price based on an inverse feed
     * @param inverseFeed Feed of the inverse pair
     * @return price Requested price rate
     * @return decimals Decimals of the requested price rate
     */
    function _getInversePrice(address inverseFeed) internal view returns (uint256 price, uint256 decimals) {
        (uint256 inversePrice, uint256 inverseFeedDecimals) = _getFeedData(inverseFeed);
        require(inverseFeedDecimals <= INVERSE_FEED_MAX_DECIMALS, 'FEED_DECIMALS_TOO_BIG');

        // Prices are requested for different purposes, we are rounding down always to follow a single strategy
        price = FixedPoint.ONE.divDown(inversePrice);
        // No need for checked math as we are checking it manually beforehand
        decimals = INVERSE_FEED_MAX_DECIMALS.uncheckedSub(inverseFeedDecimals);
    }

    /**
     * @dev Report a price based on two relative feeds
     * @param baseFeed Feed of the base token
     * @param quoteFeed Feed of the quote token
     * @return price Requested price rate
     * @return decimals Decimals of the requested price rate
     */
    function _getPivotPrice(address baseFeed, address quoteFeed)
        internal
        view
        returns (uint256 price, uint256 decimals)
    {
        (uint256 basePrice, uint256 baseFeedDecimals) = _getFeedData(baseFeed);
        (uint256 quotePrice, uint256 quoteFeedDecimals) = _getFeedData(quoteFeed);

        // No need for checked math as an uint8 + FP_DECIMALS (constant) will always fit in an uint256
        require(quoteFeedDecimals <= baseFeedDecimals + FP_DECIMALS, 'QUOTE_FEED_DECIMALS_TOO_BIG');

        // Price is base/quote = (base/pivot) / (quote/pivot)
        // Prices are requested for different purposes, we are rounding down always to follow a single strategy
        price = basePrice.divDown(quotePrice);
        // No need for checked math as we are checking it manually beforehand
        decimals = baseFeedDecimals.uncheckedAdd(FP_DECIMALS).uncheckedSub(quoteFeedDecimals);
    }

    /**
     * @dev Upscales or downscale a price rate
     * @param price Value to be scaled
     * @param priceDecimals Decimals in which `price` is originally represented
     * @return resultDecimals Decimals requested for the result
     */
    function _scalePrice(uint256 price, uint256 priceDecimals, uint256 resultDecimals) internal pure returns (uint256) {
        return
            resultDecimals >= priceDecimals
                ? (price * 10**(resultDecimals.uncheckedSub(priceDecimals)))
                : (price / 10**(priceDecimals.uncheckedSub(resultDecimals)));
    }

    /**
     * @dev Decodes a list of off-chain encoded prices. It returns an empty array in case it is malformed. It reverts
     * if the data is considered properly encoded but the signer is not allowed.
     * @param data Data to be decoded
     */
    function _decodePricesData(bytes memory data) internal view returns (PriceData[] memory) {
        if (!_isOffChainDataEncodedProperly(data)) return new PriceData[](0);

        (PriceData[] memory prices, bytes memory signature) = abi.decode(data, (PriceData[], bytes));
        bytes32 message = ECDSA.toEthSignedMessageHash(keccak256(abi.encode(prices)));
        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(message, signature);
        require(error == ECDSA.RecoverError.NoError && isSignerAllowed(recovered), 'ORACLE_INVALID_SIGNER');
        return prices;
    }

    /**
     * @dev Sets the off-chain oracle signer
     * @param signer Address of the signer to be set
     */
    function _setSigner(address signer, bool allowed) internal {
        allowed ? _signers.add(signer) : _signers.remove(signer);
        emit SignerSet(signer, allowed);
    }

    /**
     * @dev Sets a new feed for a (base, quote) pair
     * @param base Token base to be set
     * @param quote Token quote to be set
     * @param feed Feed to be set
     */
    function _setFeed(address base, address quote, address feed) internal {
        getFeed[base][quote] = feed;
        emit FeedSet(base, quote, feed);
    }

    /**
     * @dev Tells if a data array is encoded as expected for a list off-chain prices
     * @param data Data to be evaluated
     */
    function _isOffChainDataEncodedProperly(bytes memory data) private pure returns (bool) {
        // Check the minimum expected data length based on how ABI encoding works.
        // Considering the structure (PriceData[], bytes), the encoding should have the following pattern:
        //
        // [ PRICES OFFSET ][ SIG OFFSET ][ PRICES DATA LENGTH ][ PRICES DATA ][ SIG LENGTH ][ VRS SIG ]
        // [       32      ][     32     ][         32         ][   N * 128   ][     32     ][  32 * 3 ]
        //
        // Therefore the minimum length expected is:
        uint256 minimumLength = 32 + 32 + 32 + 32 + 96;
        if (data.length < minimumLength) return false;

        // There must be at least the same number of bytes specified by the prices offset value:
        uint256 pricesOffset = data.toUint256(0);
        if (data.length < pricesOffset) return false;

        // The exact expected data length can be now computed based on the prices length:
        uint256 pricesLength = data.toUint256(pricesOffset);
        if (data.length != minimumLength + (pricesLength * 128)) return false;

        // The signature offset can be computed based on the prices length:
        uint256 signatureOffset = data.toUint256(32);
        if (signatureOffset != (32 * 3) + (pricesLength * 128)) return false;

        // Finally the signature length must be 64 or 65:
        uint256 signatureLength = data.toUint256(signatureOffset);
        if (signatureLength != 64 && signatureLength != 65) return false;

        // Finally confirm the data types for each of the price data attributes:
        for (uint256 i = 0; i < pricesLength; i++) {
            uint256 offset = i * 128;

            // Base should be a valid address
            uint256 priceBase = data.toUint256(32 * 3 + offset);
            if (priceBase > type(uint160).max) return false;

            // Quote should be a valid address
            uint256 priceQuote = data.toUint256(32 * 4 + offset);
            if (priceQuote > type(uint160).max) return false;
        }

        // Otherwise the data can be decoded properly
        return true;
    }
}

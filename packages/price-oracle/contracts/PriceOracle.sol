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
import '@openzeppelin/contracts/utils/math/SafeCast.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/math/UncheckedMath.sol';

import './interfaces/IPriceOracle.sol';
import './interfaces/IPriceFeedProvider.sol';

/**
 * @title PriceOracle
 * @dev Oracle that interfaces with external feeds to provide quotes for tokens based on any other token.
 *
 * This Price Oracle only operates with ERC20 tokens, it does not allow querying quotes for any other denomination.
 * Additionally, it only supports external feeds that implement ChainLink's proposed `AggregatorV3Interface` interface.
 *
 * IMPORTANT! As many other implementations in this repo, this contract is intended to be used as a LIBRARY, not
 * a contract. Due to limitations of the Solidity compiler, it's not possible to work with immutable variables in
 * libraries yet. Therefore, we are relying on contracts without storage variables so they can be safely
 * delegate-called if desired.
 */
contract PriceOracle is IPriceOracle {
    using FixedPoint for uint256;
    using UncheckedMath for uint256;

    // Number of decimals used for fixed point operations: 18
    uint256 private constant FP_DECIMALS = 18;

    // Maximum number of decimals supported for a token when computing inverse quotes: 36
    uint256 private constant INVERSE_FEED_MAX_DECIMALS = 36;

    // It allows denoting a single token to pivot between feeds in case a direct path is not available
    address public immutable pivot;

    /**
     * @dev Creates a new Price Oracle implementation with the references that should be shared among all implementations
     * @param _pivot Address of the token to be used as the pivot
     */
    constructor(address _pivot) {
        pivot = _pivot;
    }

    /**
     * @dev Tells the price of a token (base) in a given quote. The response is expressed using the corresponding
     * number of decimals so that when performing a fixed point product of it by a `base` amount it results in
     * a value expressed in `quote` decimals.
     * @param provider Provider to fetch the price feeds from
     * @param base Token to rate
     * @param quote Token used for the price rate
     */
    function getPrice(address provider, address base, address quote) external view override returns (uint256) {
        if (base == quote) return FixedPoint.ONE;

        // If `base * result / 1e18` must be expressed in `quote` decimals, then
        uint256 baseDecimals = IERC20Metadata(base).decimals();
        uint256 quoteDecimals = IERC20Metadata(quote).decimals();

        // No need for checked math as an uint8 + FP_DECIMALS (constant) will always fit in an uint256
        require(baseDecimals <= quoteDecimals.uncheckedAdd(FP_DECIMALS), 'BASE_DECIMALS_TOO_BIG');

        // No need for checked math as we are checking it manually beforehand
        uint256 resultDecimals = quoteDecimals.uncheckedAdd(FP_DECIMALS).uncheckedSub(baseDecimals);
        (uint256 price, uint256 decimals) = _getPrice(IPriceFeedProvider(provider), base, quote);
        return _scalePrice(price, decimals, resultDecimals);
    }

    /**
     * @dev Internal function to tell the price of a token (base) in a given quote.
     * @param provider Provider to fetch the price feeds from
     * @param base Token to rate
     * @param quote Token used for the price rate
     * @return price Requested price rate
     * @return decimals Decimals of the requested price rate
     */
    function _getPrice(IPriceFeedProvider provider, address base, address quote)
        internal
        view
        returns (uint256 price, uint256 decimals)
    {
        address feed = provider.getPriceFeed(base, quote);
        if (feed != address(0)) return _getFeedData(feed);

        address inverseFeed = provider.getPriceFeed(quote, base);
        if (inverseFeed != address(0)) return _getInversePrice(inverseFeed);

        address baseFeed = provider.getPriceFeed(base, pivot);
        address quoteFeed = provider.getPriceFeed(quote, pivot);
        if (baseFeed != address(0) && quoteFeed != address(0)) return _getPivotPrice(baseFeed, quoteFeed);

        revert('MISSING_PRICE_FEED');
    }

    /**
     * @dev Internal function to fetch data from a price feed
     * @param feed Address of the price feed to fetch data from. It must support ChainLink's `AggregatorV3Interface`.
     * @return price Requested price
     * @return decimals Decimals of the requested price
     */
    function _getFeedData(address feed) internal view returns (uint256 price, uint256 decimals) {
        decimals = AggregatorV3Interface(feed).decimals();
        (, int256 priceInt, , , ) = AggregatorV3Interface(feed).latestRoundData();
        price = SafeCast.toUint256(priceInt);
    }

    /**
     * @dev Internal function to report a price based on an inverse feed
     * @param inverseFeed Price feed of the inverse pair
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
     * @dev Internal function to report a price based on two relative price feeds
     * @param baseFeed Price feed of the base token
     * @param quoteFeed Price feed of the quote token
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
     * @dev Internal function to upscale or downscale a price rate
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
}

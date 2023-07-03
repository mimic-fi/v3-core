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

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './BaseTask.sol';
import '../interfaces/base/ITokenThresholdTask.sol';

/**
 * @dev Token threshold task. It mainly works with token threshold configs that can be used to tell if
 * a specific token amount is compliant with certain minimum or maximum values. Token threshold tasks
 * make use of a default threshold config as a fallback in case there is no custom threshold defined for the token
 * being evaluated.
 */
abstract contract TokenThresholdTask is ITokenThresholdTask, BaseTask {
    using FixedPoint for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Default threshold
    Threshold private _defaultThreshold;

    // Custom thresholds per token
    TokenToThresholdMap private _customThresholds;

    /**
     * @dev Enumerable map of tokens to threshold configs
     */
    struct TokenToThresholdMap {
        EnumerableSet.AddressSet tokens;
        mapping (address => Threshold) thresholds;
    }

    /**
     * @dev Custom token threshold config
     */
    struct CustomThreshold {
        address token;
        Threshold threshold;
    }

    /**
     * @dev Token threshold config. Only used in the initializer.
     * @param defaultThreshold Default threshold to be set
     * @param tokens List of tokens to define a custom threshold for
     * @param thresholds List of custom thresholds to define for each token
     */
    struct TokenThresholdConfig {
        Threshold defaultThreshold;
        CustomThreshold[] customThresholds;
    }

    /**
     * @dev Initializes a token threshold task
     */
    function _initialize(TokenThresholdConfig memory config) internal onlyInitializing {
        _setDefaultTokenThreshold(config.defaultThreshold);
        for (uint256 i = 0; i < config.customThresholds.length; i++) {
            _setCustomTokenThreshold(config.customThresholds[i].token, config.customThresholds[i].threshold);
        }
    }

    /**
     * @dev Tells the default token threshold
     */
    function defaultTokenThreshold() external view override returns (Threshold memory) {
        return _defaultThreshold;
    }

    /**
     * @dev Tells the token threshold defined for a specific token
     * @param token Address of the token being queried
     */
    function customTokenThreshold(address token) public view override returns (Threshold memory threshold) {
        return _customThresholds.thresholds[token];
    }

    /**
     * @dev Sets a new default threshold config
     * @param threshold Threshold config to be set as the default one
     */
    function setDefaultTokenThreshold(Threshold memory threshold)
        external
        override
        authP(authParams(threshold.token, threshold.min, threshold.max))
    {
        _setDefaultTokenThreshold(threshold);
    }

    /**
     * @dev Sets a custom token threshold
     * @param token Address of the token to set a custom threshold for
     * @param threshold Custom token threshold to be set for the given token
     */
    function setCustomTokenThreshold(address token, Threshold memory threshold)
        external
        override
        authP(authParams(token, threshold.token, threshold.min, threshold.max))
    {
        _setCustomTokenThreshold(token, threshold);
    }

    /**
     * @dev Tells if a token and amount are compliant with a threshold, returns true if the threshold is not set
     * @param threshold Threshold to be evaluated
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     */
    function _isTokenThresholdValid(Threshold memory threshold, address token, uint256 amount)
        internal
        view
        returns (bool)
    {
        if (threshold.token == address(0)) return true;
        uint256 price = _getPrice(token, threshold.token);
        uint256 convertedAmount = amount.mulDown(price);
        return convertedAmount >= threshold.min && (threshold.max == 0 || convertedAmount <= threshold.max);
    }

    /**
     * @dev Reverts if the requested token and amount does not comply with the given threshold config
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        bool hasCustomThreshold = _customThresholds.tokens.contains(token);
        Threshold memory threshold = hasCustomThreshold ? customTokenThreshold(token) : _defaultThreshold;
        require(_isTokenThresholdValid(threshold, token, amount), 'TASK_TOKEN_THRESHOLD_NOT_MET');
    }

    /**
     * @dev Sets a new default threshold config
     * @param threshold Threshold config to be set as the default one
     */
    function _setDefaultTokenThreshold(Threshold memory threshold) internal {
        if (!_isVoidThreshold(threshold)) _validateThreshold(threshold);
        _defaultThreshold = threshold;
        emit DefaultTokenThresholdSet(threshold);
    }

    /**
     * @dev Sets a custom of tokens thresholds
     * @param token Address of the token to set a custom threshold for
     * @param threshold Custom token threshold to be set for the given token
     */
    function _setCustomTokenThreshold(address token, Threshold memory threshold) internal {
        require(token != address(0), 'TASK_THRESHOLD_TOKEN_ZERO');
        _customThresholds.thresholds[token] = threshold;

        if (_isVoidThreshold(threshold)) {
            _customThresholds.tokens.remove(token);
        } else {
            _validateThreshold(threshold);
            _customThresholds.tokens.add(token);
        }

        emit CustomTokenThresholdSet(token, threshold);
    }

    /**
     * @dev Tells if a threshold is void: no token, no min, no max
     */
    function _isVoidThreshold(Threshold memory threshold) private pure returns (bool) {
        return threshold.token == address(0) && threshold.max == 0 && threshold.min == 0;
    }

    /**
     * @dev Reverts if a threshold is not considered valid, that is if the token is zero or if the max amount is greater
     * than zero but lower than the min amount.
     */
    function _validateThreshold(Threshold memory threshold) private pure {
        if (threshold.token == address(0) && threshold.max == 0 && threshold.min == 0) return;
        require(threshold.token != address(0), 'TASK_BAD_THRESHOLD_TOKEN_ZERO');
        require(threshold.max == 0 || threshold.max >= threshold.min, 'TASK_BAD_THRESHOLD_MAX_LT_MIN');
    }
}

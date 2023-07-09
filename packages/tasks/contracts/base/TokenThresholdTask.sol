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

    // Default threshold
    Threshold private _defaultThreshold;

    // Custom thresholds per token
    mapping (address => Threshold) internal _customThresholds;

    /**
     * @dev Custom token threshold config. Only used in the initializer.
     */
    struct CustomThresholdConfig {
        address token;
        Threshold threshold;
    }

    /**
     * @dev Token threshold config. Only used in the initializer.
     * @param defaultThreshold Default threshold to be set
     * @param customThresholdConfigs List of custom threshold configs to be set
     */
    struct TokenThresholdConfig {
        Threshold defaultThreshold;
        CustomThresholdConfig[] customThresholdConfigs;
    }

    /**
     * @dev Initializes a token threshold task
     */
    function _initialize(TokenThresholdConfig memory config) internal onlyInitializing {
        Threshold memory defaultThreshold = config.defaultThreshold;
        _setDefaultTokenThreshold(defaultThreshold.token, defaultThreshold.min, defaultThreshold.max);

        for (uint256 i = 0; i < config.customThresholdConfigs.length; i++) {
            CustomThresholdConfig memory customThresholdConfig = config.customThresholdConfigs[i];
            Threshold memory custom = customThresholdConfig.threshold;
            _setCustomTokenThreshold(customThresholdConfig.token, custom.token, custom.min, custom.max);
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
    function customTokenThreshold(address token) public view override returns (Threshold memory) {
        return _customThresholds[token];
    }

    /**
     * @dev Sets a new default threshold config
     * @param thresholdToken New threshold token to be set
     * @param thresholdMin New threshold minimum to be set
     * @param thresholdMax New threshold maximum to be set
     */
    function setDefaultTokenThreshold(address thresholdToken, uint256 thresholdMin, uint256 thresholdMax)
        external
        override
        authP(authParams(thresholdToken, thresholdMin, thresholdMax))
    {
        _setDefaultTokenThreshold(thresholdToken, thresholdMin, thresholdMax);
    }

    /**
     * @dev Sets a custom token threshold
     * @param token Address of the token to set a custom threshold for
     * @param thresholdToken New custom threshold token to be set
     * @param thresholdMin New custom threshold minimum to be set
     * @param thresholdMax New custom threshold maximum to be set
     */
    function setCustomTokenThreshold(address token, address thresholdToken, uint256 thresholdMin, uint256 thresholdMax)
        external
        override
        authP(authParams(token, thresholdToken, thresholdMin, thresholdMax))
    {
        _setCustomTokenThreshold(token, thresholdToken, thresholdMin, thresholdMax);
    }

    /**
     * @dev Tells the threshold applicable for a token, it prioritizes custom thresholds over the default one
     * @param token Address of the token being queried
     */
    function _getApplicableThreshold(address token) internal view returns (Threshold storage) {
        Threshold storage customThreshold = _customThresholds[token];
        return customThreshold.token == address(0) ? _defaultThreshold : customThreshold;
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
        uint256 convertedAmount = threshold.token == token ? amount : amount.mulDown(_getPrice(token, threshold.token));
        return convertedAmount >= threshold.min && (threshold.max == 0 || convertedAmount <= threshold.max);
    }

    /**
     * @dev Reverts if the requested token and amount does not comply with the given threshold config
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        Threshold memory threshold = _getApplicableThreshold(token);
        require(_isTokenThresholdValid(threshold, token, amount), 'TASK_TOKEN_THRESHOLD_NOT_MET');
    }

    /**
     * @dev Sets a new default threshold config
     * @param thresholdToken New threshold token to be set
     * @param thresholdMin New threshold minimum to be set
     * @param thresholdMax New threshold maximum to be set
     */
    function _setDefaultTokenThreshold(address thresholdToken, uint256 thresholdMin, uint256 thresholdMax) internal {
        _setThreshold(_defaultThreshold, thresholdToken, thresholdMin, thresholdMax);
        emit DefaultTokenThresholdSet(thresholdToken, thresholdMin, thresholdMax);
    }

    /**
     * @dev Sets a custom of tokens thresholds
     * @param token Address of the token to set a custom threshold for
     * @param thresholdToken New custom threshold token to be set
     * @param thresholdMin New custom threshold minimum to be set
     * @param thresholdMax New custom threshold maximum to be set
     */
    function _setCustomTokenThreshold(address token, address thresholdToken, uint256 thresholdMin, uint256 thresholdMax)
        internal
    {
        require(token != address(0), 'TASK_THRESHOLD_TOKEN_ZERO');
        _setThreshold(_customThresholds[token], thresholdToken, thresholdMin, thresholdMax);
        emit CustomTokenThresholdSet(token, thresholdToken, thresholdMin, thresholdMax);
    }

    /**
     * @dev Sets a threshold
     * @param threshold Threshold to be updated
     * @param token New threshold token to be set
     * @param min New threshold minimum to be set
     * @param max New threshold maximum to be set
     */
    function _setThreshold(Threshold storage threshold, address token, uint256 min, uint256 max) private {
        // If there is no threshold, all values must be zero
        bool isZeroThreshold = token == address(0) && min == 0 && max == 0;
        bool isNonZeroThreshold = token != address(0) && (max == 0 || max >= min);
        require(isZeroThreshold || isNonZeroThreshold, 'TASK_INVALID_THRESHOLD_INPUT');

        threshold.token = token;
        threshold.min = min;
        threshold.max = max;
    }
}

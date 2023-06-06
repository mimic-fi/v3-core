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

import '@openzeppelin/contracts/access/Ownable.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './interfaces/IFeeController.sol';

/**
 * @title Fee Controller
 * @dev Controller used to manage all the fee-related information of the protocol
 */
contract FeeController is IFeeController, Ownable {
    // Default fee percentage
    uint256 private _defaultFeePercentage;

    // Address of the default collector
    address private _defaultFeeCollector;

    // List of custom fee percentages indexed by smart vault address
    mapping (address => uint256) private _customFeePercentage;

    // List of custom fee collectors indexed by smart vault address
    mapping (address => address) private _customFeeCollector;

    /**
     * @dev Creates a new Fee collector contract
     * @param pct Default fee percentage to be set
     * @param collector Default fee collector to be set
     * @param owner Address that will own the fee collector
     */
    constructor(uint256 pct, address collector, address owner) {
        _transferOwnership(owner);
        _setDefaultFeePercentage(pct);
        _setDefaultFeeCollector(collector);
    }

    /**
     * @dev Tells the default fee percentage
     */
    function getDefaultFeePercentage() external view returns (uint256) {
        return _defaultFeePercentage;
    }

    /**
     * @dev Tells the default fee collector
     */
    function getDefaultFeeCollector() external view returns (address) {
        return _defaultFeeCollector;
    }

    /**
     * @dev Tells the fee information for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFee(address smartVault) external view override returns (uint256 pct, address collector) {
        return (getFeePercentage(smartVault), getFeeCollector(smartVault));
    }

    /**
     * @dev Tells the fee percentage for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFeePercentage(address smartVault) public view override returns (uint256) {
        uint256 customFeePercentage = _customFeePercentage[smartVault];
        return customFeePercentage > 0 ? customFeePercentage : _defaultFeePercentage;
    }

    /**
     * @dev Tells the fee collector for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFeeCollector(address smartVault) public view override returns (address) {
        address customFeeCollector = _customFeeCollector[smartVault];
        return customFeeCollector != address(0) ? customFeeCollector : _defaultFeeCollector;
    }

    /**
     * @dev Sets the default fee percentage
     * @param pct Default fee percentage to be set
     */
    function setDefaultFeePercentage(uint256 pct) external override onlyOwner {
        _setDefaultFeePercentage(pct);
    }

    /**
     * @dev Sets the default fee collector
     * @param collector Default fee collector to be set
     */
    function setDefaultFeeCollector(address collector) external override onlyOwner {
        _setDefaultFeeCollector(collector);
    }

    /**
     * @dev Sets a custom fee percentage
     * @param smartVault Address of smart vault to set a fee percentage for
     * @param pct Fee percentage to be set
     */
    function setCustomFeePercentage(address smartVault, uint256 pct) external override onlyOwner {
        require(pct < FixedPoint.ONE, 'FEE_CONTROLLER_PCT_ABOVE_ONE');
        _customFeePercentage[smartVault] = pct;
        emit CustomFeePercentageSet(smartVault, pct);
    }

    /**
     * @dev Sets a custom fee collector
     * @param smartVault Address of smart vault to set a fee collector for
     * @param collector Fee collector to be set
     */
    function setCustomFeeCollector(address smartVault, address collector) external override onlyOwner {
        require(collector != address(0), 'FEE_CONTROLLER_COLLECTOR_ZERO');
        _customFeeCollector[smartVault] = collector;
        emit CustomFeeCollectorSet(smartVault, collector);
    }

    /**
     * @dev Sets the default fee percentage
     * @param pct Default fee percentage to be set
     */
    function _setDefaultFeePercentage(uint256 pct) private {
        require(pct < FixedPoint.ONE, 'FEE_CONTROLLER_PCT_ABOVE_ONE');
        _defaultFeePercentage = pct;
        emit DefaultFeePercentageSet(pct);
    }

    /**
     * @dev Sets the default fee collector
     * @param collector Default fee collector to be set
     */
    function _setDefaultFeeCollector(address collector) private {
        require(collector != address(0), 'FEE_CONTROLLER_COLLECTOR_ZERO');
        _defaultFeeCollector = collector;
        emit DefaultFeeCollectorSet(collector);
    }
}

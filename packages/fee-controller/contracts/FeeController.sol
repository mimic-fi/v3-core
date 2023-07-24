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
    /**
     * @dev Fee information stored per smart vault
     * @param pct Current fee percentage that should be applied to a smart vault
     * @param maxPct Maximum fee percentage that can be charged to a smart vault
     * @param collector Address that will receive the charged fees for this smart vault
     */
    struct Fee {
        uint256 pct;
        uint256 maxPct;
        address collector;
    }

    // Address of the default collector
    address public override defaultFeeCollector;

    // List of fees indexed per smart vault address
    mapping (address => Fee) internal _fees;

    /**
     * @dev Creates a new fee controller contract
     * @param collector Default fee collector to be set
     * @param owner Address that will own the fee collector
     */
    constructor(address collector, address owner) {
        _transferOwnership(owner);
        _setDefaultFeeCollector(collector);
    }

    /**
     * @dev Tells if there is a fee set for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function hasFee(address smartVault) external view override returns (bool) {
        return _fees[smartVault].maxPct != 0;
    }

    /**
     * @dev Tells the fee information for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFee(address smartVault) external view override returns (uint256 max, uint256 pct, address collector) {
        Fee storage fee = _fees[smartVault];
        if (fee.maxPct == 0) revert FeeControllerSvNotSet(smartVault);

        pct = fee.pct;
        max = fee.maxPct;
        collector = fee.collector != address(0) ? fee.collector : defaultFeeCollector;
    }

    /**
     * @dev Sets the default fee collector
     * @param collector Default fee collector to be set
     */
    function setDefaultFeeCollector(address collector) external override onlyOwner {
        _setDefaultFeeCollector(collector);
    }

    /**
     * @dev Sets a max fee percentage for a smart vault
     * @param smartVault Address of smart vault to set a fee percentage for
     * @param maxPct Max fee percentage to be set
     */
    function setMaxFeePercentage(address smartVault, uint256 maxPct) external override onlyOwner {
        if (maxPct == 0) revert FeeControllerMaxPctZero(smartVault);

        Fee storage fee = _fees[smartVault];
        if (fee.maxPct == 0) {
            if (maxPct >= FixedPoint.ONE) revert FeeControllerMaxPctAboveOne(smartVault);
        } else {
            if (maxPct >= fee.maxPct) revert FeeControllerMaxPctAbovePrevious(smartVault, maxPct, fee.maxPct);
        }

        fee.maxPct = maxPct;
        emit MaxFeePercentageSet(smartVault, maxPct);
        if (fee.pct == 0 || fee.pct > maxPct) _setFeePercentage(smartVault, maxPct);
    }

    /**
     * @dev Sets a fee percentage for a smart vault
     * @param smartVault Address of smart vault to set a fee percentage for
     * @param pct Fee percentage to be set
     */
    function setFeePercentage(address smartVault, uint256 pct) external override onlyOwner {
        _setFeePercentage(smartVault, pct);
    }

    /**
     * @dev Sets a fee collector for a smart vault
     * @param smartVault Address of smart vault to set a fee collector for
     * @param collector Fee collector to be set
     */
    function setFeeCollector(address smartVault, address collector) external override onlyOwner {
        if (collector == address(0)) revert FeeControllerCollectorZero(smartVault);
        Fee storage fee = _fees[smartVault];
        if (fee.maxPct == 0) revert FeeControllerSvNotSet(smartVault);
        fee.collector = collector;
        emit FeeCollectorSet(smartVault, collector);
    }

    /**
     * @dev Sets the default fee collector
     * @param collector Default fee collector to be set
     */
    function _setDefaultFeeCollector(address collector) private {
        if (collector == address(0)) revert FeeControllerCollectorZero();
        defaultFeeCollector = collector;
        emit DefaultFeeCollectorSet(collector);
    }

    /**
     * @dev Sets the fee percentage of a smart vault
     * @param smartVault Address of the smart vault to set a fee percentage for
     * @param pct Fee percentage to be set
     */
    function _setFeePercentage(address smartVault, uint256 pct) private {
        Fee storage fee = _fees[smartVault];
        if (fee.maxPct == 0) revert FeeControllerSvNotSet(smartVault);
        if (pct > fee.maxPct) revert FeeControllerPctAboveMax(smartVault, pct, fee.maxPct);
        fee.pct = pct;
        emit FeePercentageSet(smartVault, pct);
    }
}

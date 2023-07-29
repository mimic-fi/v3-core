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

pragma solidity >=0.8.0;

/**
 * @dev Fee controller interface
 */
interface IFeeController {
    /**
     * @dev The collector to be set is zero
     */
    error FeeControllerCollectorZero();

    /**
     * @dev The requested max percentage to be set is zero
     */
    error FeeControllerMaxPctZero();

    /**
     * @dev The requested max percentage to be set is above one
     */
    error FeeControllerMaxPctAboveOne();

    /**
     * @dev No max percentage has been set for the requested smart vault
     */
    error FeeControllerMaxPctNotSet(address smartVault);

    /**
     * @dev The requested percentage to be set is above the smart vault's max percentage
     */
    error FeeControllerPctAboveMax(address smartVault, uint256 pct, uint256 maxPct);

    /**
     * @dev The requested max percentage to be set is above the previous max percentage set
     */
    error FeeControllerMaxPctAbovePrevious(address smartVault, uint256 requestedMaxPct, uint256 previousMaxPct);

    /**
     * @dev Emitted every time a default fee collector is set
     */
    event DefaultFeeCollectorSet(address indexed collector);

    /**
     * @dev Emitted every time a max fee percentage is set for a smart vault
     */
    event MaxFeePercentageSet(address indexed smartVault, uint256 maxPct);

    /**
     * @dev Emitted every time a custom fee percentage is set
     */
    event FeePercentageSet(address indexed smartVault, uint256 pct);

    /**
     * @dev Emitted every time a custom fee collector is set
     */
    event FeeCollectorSet(address indexed smartVault, address indexed collector);

    /**
     * @dev Tells the default fee collector
     */
    function defaultFeeCollector() external view returns (address);

    /**
     * @dev Tells if there is a fee set for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function hasFee(address smartVault) external view returns (bool);

    /**
     * @dev Tells the applicable fee information for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFee(address smartVault) external view returns (uint256 max, uint256 pct, address collector);

    /**
     * @dev Sets the default fee collector
     * @param collector Default fee collector to be set
     */
    function setDefaultFeeCollector(address collector) external;

    /**
     * @dev Sets a max fee percentage for a smart vault
     * @param smartVault Address of smart vault to set a fee percentage for
     * @param maxPct Max fee percentage to be set
     */
    function setMaxFeePercentage(address smartVault, uint256 maxPct) external;

    /**
     * @dev Sets a fee percentage for a smart vault
     * @param smartVault Address of smart vault to set a fee percentage for
     * @param pct Fee percentage to be set
     */
    function setFeePercentage(address smartVault, uint256 pct) external;

    /**
     * @dev Sets a fee collector for a smart vault
     * @param smartVault Address of smart vault to set a fee collector for
     * @param collector Fee collector to be set
     */
    function setFeeCollector(address smartVault, address collector) external;
}

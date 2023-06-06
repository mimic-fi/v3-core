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
     * @dev Emitted every time a default fee percentage is set
     */
    event DefaultFeePercentageSet(uint256 pct);

    /**
     * @dev Emitted every time a default fee collector is set
     */
    event DefaultFeeCollectorSet(address collector);

    /**
     * @dev Emitted every time a custom fee percentage is set
     */
    event CustomFeePercentageSet(address indexed smartVault, uint256 pct);

    /**
     * @dev Emitted every time a custom fee collector is set
     */
    event CustomFeeCollectorSet(address indexed smartVault, address collector);

    /**
     * @dev Tells the default fee percentage
     */
    function getDefaultFeePercentage() external view returns (uint256);

    /**
     * @dev Tells the default fee collector
     */
    function getDefaultFeeCollector() external view returns (address);

    /**
     * @dev Tells the fee information for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFee(address smartVault) external view returns (uint256 pct, address collector);

    /**
     * @dev Tells the fee percentage for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFeePercentage(address smartVault) external view returns (uint256);

    /**
     * @dev Tells the fee collector for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getFeeCollector(address smartVault) external view returns (address);

    /**
     * @dev Sets the default fee percentage
     * @param pct Default fee percentage to be set
     */
    function setDefaultFeePercentage(uint256 pct) external;

    /**
     * @dev Sets the default fee collector
     * @param collector Default fee collector to be set
     */
    function setDefaultFeeCollector(address collector) external;

    /**
     * @dev Sets a custom fee percentage
     * @param smartVault Address of smart vault to set a fee percentage for
     * @param pct Fee percentage to be set
     */
    function setCustomFeePercentage(address smartVault, uint256 pct) external;

    /**
     * @dev Sets a custom fee collector
     * @param smartVault Address of smart vault to set a fee collector for
     * @param collector Fee collector to be set
     */
    function setCustomFeeCollector(address smartVault, address collector) external;
}

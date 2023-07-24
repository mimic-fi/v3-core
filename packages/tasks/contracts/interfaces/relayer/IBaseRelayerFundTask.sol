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

import '../ITask.sol';

/**
 * @dev Base relayer fund task interface
 */
interface IBaseRelayerFundTask is ITask {
    /**
     * @dev The deposited amount is above the minimum threshold plus the used quota
     */
    error TaskDepositedAboveMinThreshold(uint256 deposited, uint256 min, uint256 usedQuota);

    /**
     * @dev The amount plus the deposited is above the maximum threshold plus the used quota
     */
    error TaskAmountAboveMaxThreshold(uint256 amount, uint256 deposited, uint256 max, uint256 usedQuota);

    /**
     * @dev The relayer is zero
     */
    error TaskRelayerZero();

    /**
     * @dev The task initializer is disabled
     */
    error TaskInitializerDisabled();

    /**
     * @dev Emitted every time the relayer is set
     */
    event RelayerSet(address indexed relayer);

    /**
     * @dev Tells the relayer
     */
    function relayer() external view returns (address);

    /**
     * @dev Sets the relayer
     * @param newRelayer Address of the relayer to be set
     */
    function setRelayer(address newRelayer) external;
}

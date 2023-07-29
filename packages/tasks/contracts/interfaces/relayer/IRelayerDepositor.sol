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
 * @dev Relayer depositor task interface
 */
interface IRelayerDepositor is ITask {
    /**
     * @dev The amount is zero
     */
    error TaskAmountZero();

    /**
     * @dev The relayer is zero
     */
    error TaskRelayerZero();

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

    /**
     * @dev Executes the relayer depositor task
     */
    function call(address token, uint256 amount) external;
}

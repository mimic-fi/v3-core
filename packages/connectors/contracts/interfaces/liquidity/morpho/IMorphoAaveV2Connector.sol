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

/**
 * @title MorphoAaveV2 connector interface
 */
interface IMorphoAaveV2Connector {
    /**
     * @dev Tells the reference to the MorphoAaveV2 proxy
     */
    function morpho() external view returns (address);

    /**
     * @dev Tells the reference to the Morpho's rewards distributor
     */
    function rewardsDistributor() external view returns (address);

    /**
     * @dev Supplies tokens to the Aave protocol using Morpho. Eligible for the peer-to-peer matching
     * @param aToken Address of the Aave market the user wants to interact with
     * @param token Address of the token to supply
     * @param amount Amount of tokens to supply
     */
    function join(address aToken, address token, uint256 amount) external;

    /**
     * @dev Withdraws tokens from Morpho's supply balance
     * @param aToken Address of the Aave market the user wants to interact with
     * @param amount Amount of the underlying token to withdraw
     */
    function exit(address aToken, uint256 amount) external;

    /**
     * @dev Claims Morpho token rewards
     * @param amount Amount of Morpho tokens to claim
     * @param proof Merkle proof of the rewards
     */
    function claim(uint256 amount, bytes32[] calldata proof) external;
}

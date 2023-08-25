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
 * @title Morpho Aave V3 connector interface
 */
interface IMorphoAaveV3Connector {
    /**
     * @dev The amount supplied is lower than the expected amount
     */
    error MorphoAaveV3InvalidSupply(uint256 actual, uint256 expected);

    /**
     * @dev The withdraw amount is lower than the expected amount
     */
    error MorphoAaveV3InvalidWithdraw(uint256 actual, uint256 expected);

    /**
     * @dev Tells the reference to the MorphoAaveV3 proxy
     */
    function morpho() external view returns (address);

    /**
     * @dev Tells the reference to the Morpho's rewards distributor
     */
    function rewardsDistributor() external view returns (address);

    /**
     * @dev Supplies tokens to the Aave protocol using Morpho
     * @param token Address of the token to supply
     * @param amount Amount of tokens to supply
     * @param maxIterations Maximum number of iterations allowed during the matching process. Using 4 is recommended by Morpho.
     */
    function join(address token, uint256 amount, uint256 maxIterations) external returns (uint256);

    /**
     * @dev Withdraws tokens from Morpho's supply balance
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     * @param maxIterations Maximum number of iterations allowed during the matching process. If it is less than the default, the latter will be used. Pass 0 to fallback to the default.
     */
    function exit(address token, uint256 amount, uint256 maxIterations) external returns (uint256);

    /**
     * @dev Claims Morpho token rewards
     * @param amount Amount of Morpho tokens to claim
     * @param proof Merkle proof
     */
    function claim(uint256 amount, bytes32[] calldata proof)
        external
        returns (address[] memory tokens, uint256[] memory amounts);
}

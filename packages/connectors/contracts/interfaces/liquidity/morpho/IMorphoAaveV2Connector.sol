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
 * @title Morpho Aave V2 connector interface
 */
interface IMorphoAaveV2Connector {
    /**
     * @dev The amount supplied is lower than the expected amount
     */
    error MorphoAaveV2InvalidSupply(uint256 supplied, uint256 amount);

    /**
     * @dev The withdraw amount is lower than the expected amount
     */
    error MorphoAaveV2InvalidWithdraw(uint256 withdrawn, uint256 amount);

    /**
     * @dev Tells the reference to the MorphoAaveV2 proxy
     */
    function morpho() external view returns (address);

    /**
     * @dev Tells the reference to Morpho's lens
     */
    function lens() external view returns (address);

    /**
     * @dev Tells the reference to the Morpho's rewards distributor
     */
    function rewardsDistributor() external view returns (address);

    /**
     * @dev Supplies tokens to the Aave protocol using Morpho. Eligible for the peer-to-peer matching
     * @param token Address of the token to supply
     * @param amount Amount of tokens to supply
     */
    function join(address token, uint256 amount) external returns (uint256);

    /**
     * @dev Withdraws tokens from Morpho's supply balance
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function exit(address token, uint256 amount) external returns (uint256);

    /**
     * @dev Claims Morpho token rewards
     * @param amount Amount of Morpho tokens to claim
     * @param proof Merkle proof of the rewards
     */
    function claim(uint256 amount, bytes32[] calldata proof)
        external
        returns (address[] memory tokens, uint256[] memory amounts);

    /**
     * @dev Finds the aToken address associated to a token
     * @param token Address of the token
     */
    function getAToken(address token) external view returns (address);

    /**
     * @dev Tells the supply balance of this address for the underlying token
     * @param aToken Address of the aToken associated to the token
     */
    function getSupplyBalance(address aToken) external view returns (uint256);
}

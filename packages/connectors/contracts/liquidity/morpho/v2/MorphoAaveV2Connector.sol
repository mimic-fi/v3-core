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

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IMorphoV2.sol';
import '../IRewardsDistributior.sol';
import '../../../interfaces/liquidity/morpho/IMorphoAaveV2Connector.sol';

/**
 * @title MorphoAaveV2Connector
 */
contract MorphoAaveV2Connector is IMorphoAaveV2Connector {
    using FixedPoint for uint256;

    // Reference to MorphoAaveV2
    address public immutable override morpho;

    // Reference to Morpho's RewardsDistributor
    address public immutable override rewardsDistributor;

    /**
     * @dev Creates a new MorphoAaveV2 connector
     */
    constructor(address _morpho, address _rewardsDistributor) {
        morpho = _morpho;
        rewardsDistributor = _rewardsDistributor;
    }

    /**
     * @dev Supplies tokens to the Aave protocol using Morpho. Eligible for the peer-to-peer matching
     * @param aToken Address of the Aave market the user wants to interact with
     * @param token Address of the token to supply
     * @param amount Amount of tokens to supply
     */
    function join(address aToken, address token, uint256 amount) external override {
        ERC20Helpers.approve(token, morpho, amount);
        IMorphoV2(morpho).supply(aToken, amount);
    }

    /**
     * @dev Withdraws tokens from Morpho's supply balance
     * @param aToken Address of the Aave market the user wants to interact with
     * @param amount Amount of the underlying token to withdraw
     */
    function exit(address aToken, uint256 amount) external override {
        IMorphoV2(morpho).withdraw(aToken, amount);
    }

    /**
     * @dev Claims Morpho token rewards
     * @param amount Amount of Morpho tokens to claim
     * @param proof Merkle proof of the rewards
     */
    function claim(uint256 amount, bytes32[] calldata proof) external override {
        IRewardsDistributior(rewardsDistributor).claim(address(this), amount, proof);
    }
}

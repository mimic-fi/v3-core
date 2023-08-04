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

import './IMorphoV3.sol';
import '../IRewardsDistributior.sol';
import '../../../interfaces/liquidity/morpho/IMorphoAaveV3Connector.sol';

/**
 * @title MorphoAaveV3Connector
 */
contract MorphoAaveV3Connector is IMorphoAaveV3Connector {
    using FixedPoint for uint256;

    // Reference to MorphoAaveV3
    address public immutable override morpho;

    // Reference to Morpho's RewardsDistributor
    address public immutable override rewardsDistributor;

    /**
     * @dev Creates a new MorphoAaveV3 connector
     */
    constructor(address _morpho, address _rewardsDistributor) {
        morpho = _morpho;
        rewardsDistributor = _rewardsDistributor;
    }

    /**
     * @dev Supplies tokens to the Aave protocol using Morpho. Eligible for the peer-to-peer matching
     * @param token Address of the token to supply
     * @param amount Amount of tokens to supply
     * @param maxIterations Maximum number of iterations allowed during the matching process. Using 4 is recommended by Morpho.
     */
    function join(address token, uint256 amount, uint256 maxIterations) external override returns (uint256 supplied) {
        // TODO: eth support?
        ERC20Helpers.approve(token, morpho, amount);
        supplied = IMorphoV3(morpho).supply(token, amount, address(this), maxIterations);
        if (supplied < amount) revert MorphoAaveV3InvalidSupply();
    }

    /**
     * @dev Withdraws tokens from Morpho's supply balance
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     * @param maxIterations Maximum number of iterations allowed during the matching process.
     *  If it is less than the default, the latter will be used. Pass 0 to fallback to the default.
     */
    function exit(address token, uint256 amount, uint256 maxIterations) external override returns (uint256 withdrawn) {
        withdrawn = IMorphoV3(morpho).withdraw(token, amount, address(this), address(this), maxIterations);
        if (withdrawn != amount) revert MorphoAaveV3InvalidWithdraw();
    }

    /**
     * @dev Claims Morpho token rewards
     * @param amount Amount of Morpho tokens to claim
     * @param proof Merkle proof
     */
    function claim(uint256 amount, bytes32[] calldata proof) external override {
        IRewardsDistributior(rewardsDistributor).claim(address(this), amount, proof);
    }
}

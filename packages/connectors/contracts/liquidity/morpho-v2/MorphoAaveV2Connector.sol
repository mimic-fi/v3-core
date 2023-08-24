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

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './ILendingPool.sol';
import './ILens.sol';
import './IMorphoV2.sol';
import './IRewardsDistributor.sol';
import '../../interfaces/liquidity/morpho/IMorphoAaveV2Connector.sol';

/**
 * @title MorphoAaveV2Connector
 * @dev Interfaces with Morpho Aave v2 to lend tokens
 */
contract MorphoAaveV2Connector is IMorphoAaveV2Connector {
    // Reference to MorphoAaveV2
    address public immutable override morpho;

    // Reference to Morpho's lens
    address public immutable override lens;

    // Reference to Morpho's rewards distributor
    address public immutable override rewardsDistributor;

    /**
     * @dev Creates a new MorphoAaveV2 connector
     */
    constructor(address _lens, address _rewardsDistributor) {
        morpho = ILens(_lens).morpho();
        lens = _lens;
        rewardsDistributor = _rewardsDistributor;
    }

    /**
     * @dev Supplies tokens to the Aave protocol using Morpho. Eligible for the peer-to-peer matching
     * @param token Address of the token to supply
     * @param amount Amount of tokens to supply
     */
    function join(address token, uint256 amount) external override returns (uint256 supplied) {
        if (amount == 0) return 0;
        address aToken = getAToken(token);

        uint256 initialSupplyBalance = getSupplyBalance(aToken);
        ERC20Helpers.approve(token, morpho, amount);
        IMorphoV2(morpho).supply(getAToken(token), amount);

        uint256 finalSupplyBalance = getSupplyBalance(aToken);
        supplied = finalSupplyBalance - initialSupplyBalance;
        if (supplied < amount) revert MorphoAaveV2InvalidSupply(supplied, amount);
    }

    /**
     * @dev Withdraws tokens from Morpho's supply balance
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function exit(address token, uint256 amount) external override returns (uint256 withdrawn) {
        if (amount == 0) return 0;

        uint256 initialTokenBalance = IERC20(token).balanceOf(address(this));
        IMorphoV2(morpho).withdraw(getAToken(token), amount);

        uint256 finalTokenBalance = IERC20(token).balanceOf(address(this));
        withdrawn = finalTokenBalance - initialTokenBalance;
        if (withdrawn < amount) revert MorphoAaveV2InvalidWithdraw(withdrawn, amount);
    }

    /**
     * @dev Claims Morpho token rewards
     * @param amount Amount of Morpho tokens to claim
     * @param proof Merkle proof of the rewards
     */
    function claim(uint256 amount, bytes32[] calldata proof)
        external
        override
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        IRewardsDistributor distributor = IRewardsDistributor(rewardsDistributor);
        IERC20 morphoToken = distributor.MORPHO();
        tokens = new address[](1);
        tokens[0] = address(morphoToken);

        amounts = new uint256[](1);
        if (amount == 0) return (tokens, amounts);

        uint256 initialMorphoBalance = morphoToken.balanceOf(address(this));
        distributor.claim(address(this), amount, proof);
        uint256 finalMorphoBalance = morphoToken.balanceOf(address(this));
        amounts[0] = finalMorphoBalance - initialMorphoBalance;
    }

    /**
     * @dev Finds the aToken address associated to a token
     * @param token Address of the token
     */
    function getAToken(address token) public view override returns (address) {
        address lendingPool = ILens(lens).pool();
        return ILendingPool(lendingPool).getReserveData(token).aTokenAddress;
    }

    /**
     * @dev Tells the supply balance of this address for the underlying token
     * @param aToken Address of the aToken associated to the token
     */
    function getSupplyBalance(address aToken) public view override returns (uint256 supplyBalance) {
        (, , supplyBalance) = ILens(lens).getCurrentSupplyBalanceInOf(aToken, address(this));
    }
}

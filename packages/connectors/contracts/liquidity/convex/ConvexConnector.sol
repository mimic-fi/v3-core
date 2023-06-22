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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './ICvxPool.sol';
import './ICvxBooster.sol';

/**
 * @title ConvexConnector
 */
contract ConvexConnector {
    using FixedPoint for uint256;

    // Convex booster
    ICvxBooster public immutable booster;

    /**
     * @dev Creates a new Convex connector
     */
    constructor(ICvxBooster _booster) {
        booster = _booster;
    }

    /**
     * @dev Claims Convex pool rewards for a Curve pool
     */
    function claim(address pool) external returns (address[] memory tokens, uint256[] memory amounts) {
        (, ICvxPool cvxPool) = _findCvxPoolInfo(pool);
        IERC20 crv = IERC20(cvxPool.crv());

        uint256 initialCrvBalance = crv.balanceOf(address(this));
        cvxPool.getReward(address(this));
        uint256 finalCrvBalance = crv.balanceOf(address(this));

        amounts = new uint256[](1);
        amounts[0] = finalCrvBalance - initialCrvBalance;

        tokens = new address[](1);
        tokens[0] = address(crv);
    }

    /**
     * @dev Deposits Curve pool tokens into Convex
     * @param pool Address of the Curve pool to join Convex
     * @param amount Amount of Curve pool tokens to be deposited into Convex
     */
    function join(address pool, uint256 amount) external returns (uint256) {
        if (amount == 0) return 0;
        (uint256 poolId, ICvxPool cvxPool) = _findCvxPoolInfo(pool);

        // Stake in Convex
        uint256 initialCvxPoolTokenBalance = cvxPool.balanceOf(address(this));
        IERC20(pool).approve(address(booster), amount);
        require(booster.deposit(poolId, amount), 'CONVEX_BOOSTER_DEPOSIT_FAILED');
        uint256 finalCvxPoolTokenBalance = cvxPool.balanceOf(address(this));
        return finalCvxPoolTokenBalance - initialCvxPoolTokenBalance;
    }

    /**
     * @dev Withdraws Curve pool tokens from Convex
     * @param pool Address of the Curve pool to exit from Convex
     * @param amount Amount of Convex tokens to be withdrawn
     */
    function exit(address pool, uint256 amount) external returns (uint256) {
        if (amount == 0) return 0;
        (, ICvxPool cvxPool) = _findCvxPoolInfo(pool);

        // Unstake from Convex
        uint256 initialPoolTokenBalance = IERC20(pool).balanceOf(address(this));
        require(cvxPool.withdraw(amount, true), 'CONVEX_CVX_POOL_WITHDRAW_FAILED');
        uint256 finalPoolTokenBalance = IERC20(pool).balanceOf(address(this));
        return finalPoolTokenBalance - initialPoolTokenBalance;
    }

    /**
     * @dev Finds the Convex pool information associated to the given Curve pool
     */
    function _findCvxPoolInfo(address pool) internal view returns (uint256 poolId, ICvxPool cvxPool) {
        for (uint256 i = 0; i < booster.poolLength(); i++) {
            (address lp, , address rewards, bool shutdown, ) = booster.poolInfo(i);
            if (lp == pool && !shutdown) {
                return (i, ICvxPool(rewards));
            }
        }
        revert('CONVEX_CVX_POOL_NOT_FOUND');
    }
}

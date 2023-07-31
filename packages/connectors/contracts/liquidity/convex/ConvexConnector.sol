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

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './ICvxPool.sol';
import './ICvxBooster.sol';
import '../../interfaces/liquidity/convex/IConvexConnector.sol';

/**
 * @title ConvexConnector
 */
contract ConvexConnector is IConvexConnector {
    using FixedPoint for uint256;

    // Convex booster
    address public immutable override booster;

    /**
     * @dev Creates a new Convex connector
     */
    constructor(address _booster) {
        booster = _booster;
    }

    /**
     * @dev Finds the Curve pool address associated to a Convex pool
     */
    function getCurvePool(address cvxPool) public view override returns (address) {
        uint256 poolId = ICvxPool(cvxPool).convexPoolId();
        (address pool, , , , ) = ICvxBooster(booster).poolInfo(poolId);
        return pool;
    }

    /**
     * @dev Finds the Curve pool address associated to a Convex pool
     */
    function getCvxPool(address curvePool) public view override returns (address) {
        (, ICvxPool pool) = _findCvxPoolInfo(curvePool);
        return address(pool);
    }

    /**
     * @dev Claims Convex pool rewards for a Curve pool
     */
    function claim(address cvxPool) external override returns (address[] memory tokens, uint256[] memory amounts) {
        IERC20 crv = IERC20(ICvxPool(cvxPool).crv());

        uint256 initialCrvBalance = crv.balanceOf(address(this));
        ICvxPool(cvxPool).getReward(address(this));
        uint256 finalCrvBalance = crv.balanceOf(address(this));

        amounts = new uint256[](1);
        amounts[0] = finalCrvBalance - initialCrvBalance;

        tokens = new address[](1);
        tokens[0] = address(crv);
    }

    /**
     * @dev Deposits Curve pool tokens into Convex
     * @param curvePool Address of the Curve pool to join Convex
     * @param amount Amount of Curve pool tokens to be deposited into Convex
     */
    function join(address curvePool, uint256 amount) external override returns (uint256) {
        if (amount == 0) return 0;
        (uint256 poolId, ICvxPool cvxPool) = _findCvxPoolInfo(curvePool);

        uint256 initialCvxPoolTokenBalance = cvxPool.balanceOf(address(this));
        ERC20Helpers.approve(curvePool, booster, amount);
        if (!ICvxBooster(booster).deposit(poolId, amount)) revert ConvexBoosterDepositFailed(poolId, amount);

        uint256 finalCvxPoolTokenBalance = cvxPool.balanceOf(address(this));
        return finalCvxPoolTokenBalance - initialCvxPoolTokenBalance;
    }

    /**
     * @dev Withdraws Curve pool tokens from Convex
     * @param cvxPool Address of the Convex pool to exit from Convex
     * @param amount Amount of Convex tokens to be withdrawn
     */
    function exit(address cvxPool, uint256 amount) external override returns (uint256) {
        if (amount == 0) return 0;
        address curvePool = getCurvePool(cvxPool);

        uint256 initialPoolTokenBalance = IERC20(curvePool).balanceOf(address(this));
        if (!ICvxPool(cvxPool).withdraw(amount, true)) revert ConvexCvxPoolWithdrawFailed(cvxPool, amount);

        uint256 finalPoolTokenBalance = IERC20(curvePool).balanceOf(address(this));
        return finalPoolTokenBalance - initialPoolTokenBalance;
    }

    /**
     * @dev Finds the Convex pool information associated to the given Curve pool
     */
    function _findCvxPoolInfo(address curvePool) internal view returns (uint256 poolId, ICvxPool cvxPool) {
        for (uint256 i = 0; i < ICvxBooster(booster).poolLength(); i++) {
            (address lp, , address rewards, bool shutdown, ) = ICvxBooster(booster).poolInfo(i);
            if (lp == curvePool && !shutdown) {
                return (i, ICvxPool(rewards));
            }
        }
        revert ConvexCvxPoolNotFound(curvePool);
    }
}

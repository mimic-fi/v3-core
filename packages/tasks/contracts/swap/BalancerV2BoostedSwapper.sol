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

import '@mimic-fi/helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV2Vault.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV2SwapConnector.sol';

import './BalancerV2BptSwapper.sol';
import '../interfaces/liquidity/balancer/IBalancerBoostedPool.sol';

/**
 * @title Balancer v2 boosted swapper task
 * @dev Task that extends the Balancer v2 BPT swapper task specially for boosted pools
 */
contract BalancerV2BoostedSwapper is BalancerV2BptSwapper {
    /**
     * @dev Tells the token out that should be used for a token. In case there is no token out defined for the
     * requested token, it will use one of the underlying pool tokens.
     */
    function getTokenOut(address token) public view virtual override(IBaseSwapTask, BaseSwapTask) returns (address) {
        address tokenOut = BaseSwapTask.getTokenOut(token);
        if (tokenOut != address(0)) return tokenOut;

        bytes32 poolId = IBalancerBoostedPool(token).getPoolId();
        uint256 bptIndex = IBalancerBoostedPool(token).getBptIndex();
        address balancerV2Vault = IBalancerV2SwapConnector(connector).balancerV2Vault();
        (IERC20[] memory tokens, , ) = IBalancerV2Vault(balancerV2Vault).getPoolTokens(poolId);
        return address(bptIndex == 0 ? tokens[1] : tokens[0]);
    }
}

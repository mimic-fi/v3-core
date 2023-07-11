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
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';

import './Collector.sol';
import '../interfaces/primitives/ICollector.sol';

/**
 * @title Depositor task
 * @dev Task that offers a source address where funds can be withdrawn
 */
contract Depositor is ICollector, Collector {
    using SafeERC20 for IERC20;

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Tells the balance of the depositor for a given token
     * @param token Address of the token being queried
     */
    function getTaskAmount(address token) external view virtual override(IBaseTask, BaseTask) returns (uint256) {
        return ERC20Helpers.balanceOf(address(this), token);
    }

    /**
     * @dev Approves the requested amount of tokens to the smart vault in case it's not the native token
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        super._beforeTask(token, amount);
        if (!Denominations.isNativeToken(token)) {
            IERC20(token).approve(smartVault, amount);
        }
    }

    /**
     * @dev Sets the tokens source address
     * @param tokensSource Address of the tokens source to be set
     */
    function _setTokensSource(address tokensSource) internal override {
        require(tokensSource == address(this), 'TASK_DEPOSITOR_BAD_TOKENS_SOURCE');
        super._setTokensSource(tokensSource);
    }
}

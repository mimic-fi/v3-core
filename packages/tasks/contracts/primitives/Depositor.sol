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
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';

import './Collector.sol';
import '../interfaces/primitives/ICollector.sol';

/**
 * @title Depositor
 * @dev Task that extends the Collector task to be the source from where funds can be pulled
 */
contract Depositor is ICollector, Collector {
    /**
     * @dev The tokens source to be set is not the contract itself
     */
    error TaskDepositorBadTokensSource(address tokensSource);

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Approves the requested amount of tokens to the smart vault in case it's not the native token
     */
    function _beforeCollector(address token, uint256 amount) internal virtual override {
        super._beforeCollector(token, amount);
        if (!Denominations.isNativeToken(token)) {
            ERC20Helpers.approve(token, smartVault, amount);
        }
    }

    /**
     * @dev Sets the tokens source address
     * @param tokensSource Address of the tokens source to be set
     */
    function _setTokensSource(address tokensSource) internal override {
        if (tokensSource != address(this)) revert TaskDepositorBadTokensSource(tokensSource);
        super._setTokensSource(tokensSource);
    }
}

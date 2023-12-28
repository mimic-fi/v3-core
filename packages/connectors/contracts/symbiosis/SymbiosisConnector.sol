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
import '@openzeppelin/contracts/utils/Address.sol';

import '../interfaces/symbiosis/ISymbiosisConnector.sol';
import '../interfaces/symbiosis/ISymbiosisMetaRouter.sol';

/**
 * @title SymbiosisConnector
 * @dev Interfaces with Symbiosis to bridge tokens
 */
contract SymbiosisConnector is ISymbiosisConnector {
    // Reference to the Symbiosis MetaRouter contract of the source chain
    address public immutable override symbiosisMetaRouter;

    /**
     * @dev Creates a new Symbiosis connector
     * @param _symbiosisMetaRouter Address of the Symbiosis MetaRouter contract for the source chain
     */
    constructor(address _symbiosisMetaRouter) {
        symbiosisMetaRouter = _symbiosisMetaRouter;
    }

    /**
     * @dev Executes a bridge of assets using Symbiosis
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     * @param data Calldata to be sent to the symbiosis router
     */
    function execute(address token, uint256 amount, bytes memory data) external override {
        uint256 preBalance = IERC20(token).balanceOf(address(this));

        // ⚠️ NOTE: Do not approve ERC20 tokens for the Symbiosis MetaRouter. Only do it for the MetaRouterGateway.
        address metaRouterGateway = ISymbiosisMetaRouter(symbiosisMetaRouter).metaRouterGateway();
        ERC20Helpers.approve(token, metaRouterGateway, amount);
        Address.functionCall(symbiosisMetaRouter, data, 'SYMBIOSIS_BRIDGE_FAILED');

        uint256 postBalance = IERC20(token).balanceOf(address(this));
        bool isPostBalanceUnexpected = postBalance < preBalance - amount;
        if (isPostBalanceUnexpected) revert SymbiosisBridgeBadPostTokenBalance(postBalance, preBalance, amount);
    }
}

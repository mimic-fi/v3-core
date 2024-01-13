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

import './WalletOwner.sol';
import './interfaces/IWallet.sol';

/**
 * @title Wallet
 */
contract Wallet is IWallet {
    // Wallet Owner reference
    address public immutable walletOwner;

    /**
     * @dev Creates a new Wallet contract
     * @param _walletOwner Address of the Wallet Owner to be referenced
     */
    constructor(address _walletOwner) {
        walletOwner = _walletOwner;
    }

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Transfer tokens to the owner
     * @param token Address of the token to be transferred
     * @param amount Amount of tokens to be transferred
     */
    function transfer(address token, uint256 amount) external override {
        address owner = WalletOwner(walletOwner).owner();
        if (msg.sender != owner) revert WalletUnauthorizedSender(msg.sender, owner);
        if (token == address(0)) revert WalletTokenZero();
        if (amount == 0) revert WalletAmountZero();

        ERC20Helpers.transfer(token, owner, amount);
        emit Transferred(token, owner, amount);
    }
}

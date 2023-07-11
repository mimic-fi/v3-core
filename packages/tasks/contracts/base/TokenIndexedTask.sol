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

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import './BaseTask.sol';
import '../interfaces/base/ITokenIndexedTask.sol';

/**
 * @dev Token indexed task. It defines a token acceptance list to tell which are the tokens supported by the
 * task. Tokens acceptance can be configured either as an allow list or as a deny list.
 */
abstract contract TokenIndexedTask is ITokenIndexedTask, BaseTask {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Acceptance list type
    TokensAcceptanceType public override tokensAcceptanceType;

    // Enumerable set of tokens included in the acceptance list
    EnumerableSet.AddressSet private _tokens;

    /**
     * @dev Token index config. Only used in the initializer.
     * @param acceptanceType Token acceptance type to be set
     * @param tokens List of token addresses to be set for the acceptance list
     */
    struct TokenIndexConfig {
        TokensAcceptanceType acceptanceType;
        address[] tokens;
    }

    /**
     * @dev Initializes a token indexed task
     */
    function _initialize(TokenIndexConfig memory config) internal onlyInitializing {
        _setTokensAcceptanceType(config.acceptanceType);

        for (uint256 i = 0; i < config.tokens.length; i++) {
            _setTokenAcceptanceList(config.tokens[i], true);
        }
    }

    /**
     * @dev Tells if the requested token is compliant with the tokens acceptance list
     * @param token Address of the token to be checked
     */
    function isTokenAllowed(address token) public view override returns (bool) {
        return
            tokensAcceptanceType == TokensAcceptanceType.AllowList ? _tokens.contains(token) : !_tokens.contains(token);
    }

    /**
     * @dev Sets the tokens acceptance type of the task
     * @param newTokensAcceptanceType New token acceptance type to be set
     */
    function setTokensAcceptanceType(TokensAcceptanceType newTokensAcceptanceType)
        external
        override
        authP(authParams(uint8(newTokensAcceptanceType)))
    {
        _setTokensAcceptanceType(newTokensAcceptanceType);
    }

    /**
     * @dev Updates the list of tokens of the tokens acceptance list
     * @param tokens List of tokens to be updated from the acceptance list
     * @param added Whether each of the given tokens should be added or removed from the list
     */
    function setTokensAcceptanceList(address[] memory tokens, bool[] memory added) external override auth {
        require(tokens.length == added.length, 'TASK_ACCEPTANCE_BAD_LENGTH');
        for (uint256 i = 0; i < tokens.length; i++) {
            _setTokenAcceptanceList(tokens[i], added[i]);
        }
    }

    /**
     * @dev Reverts if the requested token does not comply with the tokens acceptance list
     */
    function _beforeTask(address token, uint256) internal virtual override {
        require(isTokenAllowed(token), 'TASK_TOKEN_NOT_ALLOWED');
    }

    /**
     * @dev Sets the tokens acceptance type of the task
     * @param newTokensAcceptanceType New token acceptance type to be set
     */
    function _setTokensAcceptanceType(TokensAcceptanceType newTokensAcceptanceType) internal {
        tokensAcceptanceType = newTokensAcceptanceType;
        emit TokensAcceptanceTypeSet(newTokensAcceptanceType);
    }

    /**
     * @dev Updates a token from the tokens acceptance list
     * @param token Token to be updated from the acceptance list
     * @param added Whether the token should be added or removed from the list
     */
    function _setTokenAcceptanceList(address token, bool added) internal {
        require(token != address(0), 'TASK_ACCEPTANCE_TOKEN_ZERO');
        added ? _tokens.add(token) : _tokens.remove(token);
        emit TokensAcceptanceListSet(token, added);
    }
}

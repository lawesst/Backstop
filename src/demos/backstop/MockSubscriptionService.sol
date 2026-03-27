// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../../ISubscriptionService.sol";

contract MockSubscriptionService is ISubscriptionService {
    struct Subscription {
        uint256 chainId;
        address source;
        uint256 topic0;
        uint256 topic1;
        uint256 topic2;
        uint256 topic3;
    }

    Subscription[] public subscriptions;

    function subscribe(
        uint256 chainId,
        address source,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) external override {
        subscriptions.push(Subscription(chainId, source, topic0, topic1, topic2, topic3));
    }

    function unsubscribe(
        uint256,
        address,
        uint256,
        uint256,
        uint256,
        uint256
    ) external pure override {
        revert("unused");
    }

    function subscriptionCount() external view returns (uint256) {
        return subscriptions.length;
    }
}

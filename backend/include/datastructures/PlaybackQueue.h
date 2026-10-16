#pragma once
#include <algorithm>
#include <memory>
#include <queue>
#include <stack>
#include <vector>

namespace aura {
// next owns the chain; prev and current are non-owning observers.
class DoublyLinkedList {
    struct Node {
        int songId;
        Node *prev = nullptr;
        std::unique_ptr<Node> next;
        explicit Node(int id) : songId(id) {}
    };
    std::unique_ptr<Node> head_;
    Node *tail_ = nullptr;
    Node *current_ = nullptr;

  public:
    DoublyLinkedList() = default;
    DoublyLinkedList(const DoublyLinkedList &) = delete;
    DoublyLinkedList &operator=(const DoublyLinkedList &) = delete;
    ~DoublyLinkedList() {
        clear();
    }
    void add(int id) {
        auto node = std::make_unique<Node>(id);
        node->prev = tail_;
        auto *raw = node.get();
        if (tail_)
            tail_->next = std::move(node);
        else
            head_ = std::move(node);
        tail_ = raw;
        if (!current_)
            current_ = raw;
    }
    bool remove(int id) {
        for (auto *n = head_.get(); n; n = n->next.get())
            if (n->songId == id) {
                auto *before = n->prev;
                auto *after = n->next.get();
                if (current_ == n)
                    current_ = after ? after : before;
                if (tail_ == n)
                    tail_ = before;
                auto &owner = before ? before->next : head_;
                auto removed = std::move(owner);
                owner = std::move(removed->next);
                if (owner)
                    owner->prev = before;
                return true;
            }
        return false;
    }
    int current() const {
        return current_ ? current_->songId : 0;
    }
    int next() {
        if (!current_ || !current_->next)
            return 0;
        current_ = current_->next.get();
        return current();
    }
    int previous() {
        if (!current_ || !current_->prev)
            return 0;
        current_ = current_->prev;
        return current();
    }
    bool select(int id) {
        for (auto *n = head_.get(); n; n = n->next.get())
            if (n->songId == id) {
                current_ = n;
                return true;
            }
        return false;
    }
    std::vector<int> traverse() const {
        std::vector<int> out;
        for (auto *n = head_.get(); n; n = n->next.get())
            out.push_back(n->songId);
        return out;
    }
    void clear() {
        while (head_) {
            auto next = std::move(head_->next);
            head_ = std::move(next);
        }
        tail_ = current_ = nullptr;
    }
};

class PlaybackQueue {
    DoublyLinkedList list_;
    std::stack<int> backHistory_;
    std::queue<int> incoming_;

  public:
    void append(const std::vector<int> &ids) {
        auto existing = list_.traverse();
        for (int id : ids)
            if (std::find(existing.begin(), existing.end(), id) == existing.end()) {
                incoming_.push(id);
                existing.push_back(id);
            }
        while (!incoming_.empty()) {
            list_.add(incoming_.front());
            incoming_.pop();
        }
    }
    int next(bool repeatAll) {
        int old = current();
        int id = list_.next();
        if (!id && repeatAll && !songs().empty()) {
            id = songs().front();
            list_.select(id);
        }
        if (id && old)
            backHistory_.push(old);
        return id;
    }
    int previous() {
        while (!backHistory_.empty()) {
            int id = backHistory_.top();
            backHistory_.pop();
            if (list_.select(id))
                return id;
        }
        return list_.previous();
    }
    bool select(int id) {
        return list_.select(id);
    }
    int current() const {
        return list_.current();
    }
    std::vector<int> songs() const {
        return list_.traverse();
    }
    bool remove(int id) {
        return list_.remove(id);
    }
    void clear() {
        list_.clear();
        backHistory_ = {};
        incoming_ = {};
    }
};
} // namespace aura

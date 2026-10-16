#include "datastructures/PlaybackQueue.h"
#include "models/Models.h"
#include <iostream>
#include <stdexcept>
void check(bool condition, const char *msg) {
    if (!condition)
        throw std::runtime_error(msg);
}
int main() {
    aura::DoublyLinkedList list;
    check(list.current() == 0 && list.next() == 0 && list.previous() == 0, "empty navigation");
    check(!list.remove(4), "missing removal");
    list.add(1);
    list.add(2);
    list.add(3);
    check(list.current() == 1, "initial selection");
    check(list.previous() == 0, "first boundary");
    check(list.next() == 2 && list.next() == 3 && list.next() == 0, "next boundary");
    check(list.previous() == 2, "previous");
    check(list.remove(2) && list.current() == 3, "remove current");
    check(list.remove(1) && list.traverse() == std::vector<int>{3}, "remove head");
    check(list.remove(3) && list.current() == 0, "remove final");
    for (int i = 1; i <= 100000; ++i)
        list.add(i);
    list.clear();
    check(list.traverse().empty(), "iterative large clear");
    aura::PlaybackQueue q;
    q.append({1, 2, 3, 2});
    check(q.songs() == std::vector<int>({1, 2, 3}), "FIFO unique enqueue");
    check(q.next(false) == 2 && q.next(false) == 3 && q.next(false) == 0, "exhaustion");
    check(q.previous() == 2, "stack back history");
    q.remove(1);
    check(q.previous() == 0, "removed stack item skipped");
    q.select(3);
    check(q.next(true) == 2, "repeat all");
    q.clear();
    check(q.current() == 0, "queue clear");
    std::vector<aura::Song> songs = {{1, "Zebra", "A", "C", "Jazz"},
                                     {2, "Amber", "Z", "A", "Rock"}};
    check(aura::CatalogAlgorithms::search(songs, "jAzZ").size() == 1, "case insensitive search");
    aura::CatalogAlgorithms::sort(songs, "title");
    check(songs[0].id() == 2, "title sort");
    aura::CatalogAlgorithms::sort(songs, "artist");
    check(songs[0].id() == 1, "artist sort");
    auto free = aura::makeUser(1, "A", "free"), premium = aura::makeUser(2, "B", "premium");
    check(free->getPlaylistLimit() == 20 && premium->getPlaylistLimit() == 200,
          "runtime polymorphism");
    std::cout << "PASS: linked list, FIFO, stack, boundaries, 100000-node cleanup, algorithms and "
                 "polymorphism\n";
}

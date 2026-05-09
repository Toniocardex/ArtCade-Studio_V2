add_library(artcade-physics
    src/physics.cpp
    src/rapier-backend.cpp
    src/body-pool.cpp
)
target_include_directories(artcade-physics
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-physics
    PUBLIC  artcade-core
    # PRIVATE rapier2d-c  # uncomment when Rapier C binding is available
)

#include "bridge/hierarchy_model.h"

#include "artcade/editor_core/editor_core.h"

#include <algorithm>
#include <utility>
#include <vector>

HierarchyModel::HierarchyModel(QObject *parent)
    : QAbstractItemModel(parent)
    , m_root(std::make_unique<Node>())
{
    m_root->kind = QStringLiteral("root");
}

HierarchyModel::~HierarchyModel() = default;

void HierarchyModel::setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator)
{
    m_coordinator = coordinator;
    reload();
}

HierarchyModel::Node *HierarchyModel::nodeFromIndex(const QModelIndex &index) const
{
    if (!index.isValid()) {
        return m_root.get();
    }
    return static_cast<Node *>(index.internalPointer());
}

void HierarchyModel::reload()
{
    beginResetModel();
    m_root->children.clear();
    if (m_coordinator && m_coordinator->hasProject()) {
        const ArtCade::ProjectDoc &doc = m_coordinator->document();
        std::vector<std::pair<std::string, const ArtCade::SceneDef *>> scenes;
        scenes.reserve(doc.scenes.size());
        for (const auto &[scene_id, scene] : doc.scenes) {
            scenes.emplace_back(scene_id, &scene);
        }
        std::sort(scenes.begin(), scenes.end(), [](const auto &a, const auto &b) {
            const std::string &an = a.second->name.empty() ? a.first : a.second->name;
            const std::string &bn = b.second->name.empty() ? b.first : b.second->name;
            if (an != bn) {
                return an < bn;
            }
            return a.first < b.first;
        });

        for (const auto &[scene_id, scene_ptr] : scenes) {
            const ArtCade::SceneDef &scene = *scene_ptr;
            auto scene_node = std::make_unique<Node>();
            scene_node->kind = QStringLiteral("scene");
            scene_node->display =
                QString::fromStdString(scene.name.empty() ? scene_id : scene.name);
            scene_node->parent = m_root.get();

            for (const ArtCade::SceneInstanceDef &inst : scene.instances) {
                auto child = std::make_unique<Node>();
                child->kind = QStringLiteral("instance");
                child->entityId = inst.id;
                child->display = inst.instanceName.empty()
                    ? QString::fromStdString(inst.objectTypeId)
                    : QString::fromStdString(inst.instanceName);
                child->parent = scene_node.get();
                scene_node->children.push_back(std::move(child));
            }
            m_root->children.push_back(std::move(scene_node));
        }
    }
    endResetModel();
}

QModelIndex HierarchyModel::index(int row, int column, const QModelIndex &parent) const
{
    if (column != 0 || row < 0) {
        return {};
    }
    Node *parent_node = nodeFromIndex(parent);
    if (!parent_node || row >= static_cast<int>(parent_node->children.size())) {
        return {};
    }
    Node *child = parent_node->children[static_cast<size_t>(row)].get();
    return createIndex(row, 0, child);
}

QModelIndex HierarchyModel::parent(const QModelIndex &index) const
{
    if (!index.isValid()) {
        return {};
    }
    Node *node = nodeFromIndex(index);
    if (!node || !node->parent || node->parent == m_root.get()) {
        return {};
    }
    Node *parent_node = node->parent;
    Node *grand = parent_node->parent;
    if (!grand) {
        return {};
    }
    for (int i = 0; i < static_cast<int>(grand->children.size()); ++i) {
        if (grand->children[static_cast<size_t>(i)].get() == parent_node) {
            return createIndex(i, 0, parent_node);
        }
    }
    return {};
}

int HierarchyModel::rowCount(const QModelIndex &parent) const
{
    Node *node = nodeFromIndex(parent);
    return node ? static_cast<int>(node->children.size()) : 0;
}

int HierarchyModel::columnCount(const QModelIndex &parent) const
{
    Q_UNUSED(parent);
    return 1;
}

QVariant HierarchyModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid()) {
        return {};
    }
    const Node *node = nodeFromIndex(index);
    if (!node) {
        return {};
    }
    switch (role) {
    case DisplayRole:
        return node->display;
    case NodeKindRole:
        return node->kind;
    case StableIdRole:
        return node->entityId;
    case DepthHintRole:
        return node->kind == QStringLiteral("scene") ? 0 : 1;
    default:
        return {};
    }
}

QHash<int, QByteArray> HierarchyModel::roleNames() const
{
    return {
        {Qt::DisplayRole, "display"},
        {NodeKindRole, "nodeKind"},
        {StableIdRole, "stableId"},
        {DepthHintRole, "depthHint"},
    };
}

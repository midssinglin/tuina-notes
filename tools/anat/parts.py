# 部位對照：FMA 名稱 → (類別, 群組 id, 中文名, 目標三角形數)
import re
MUSCLE_MAP = [
 (r'Descending part of (left|right) trapezius','trap_u'),(r'Transverse part of (left|right) trapezius','trap_m'),(r'Ascending part of (left|right) trapezius','trap_l'),
 (r'(Left|Right) levator scapulae','levator'),(r'(Left|Right) sternocleidomastoid','scm'),(r'(Left|Right) scalenus','scalene'),
 (r'(Left|Right) splenius','splenius'),(r'(Left|Right) (rectus capitis posterior|obliquus capitis)','subocc'),
 (r'part of (left|right) masseter','masseter'),(r'(Left|Right) temporalis','temporalis'),
 (r'(Left|Right) rhomboid','rhomboid'),(r'(Left|Right) supraspinatus','supraspinatus'),(r'(Left|Right) infraspinatus','infraspinatus'),
 (r'(Left|Right) teres minor','teres_minor'),(r'(Left|Right) teres major','teres_major'),(r'(Left|Right) subscapularis','subscap'),
 (r'(Left|Right) latissimus dorsi','lat'),(r'(Left|Right) serratus anterior','serratus'),(r'part of (left|right) pectoralis major','pec_major'),
 (r'(Left|Right) pectoralis minor','pec_minor'),(r'part of (left|right) deltoid','deltoid'),(r'head of (left|right) biceps brachii','biceps'),
 (r'head of (left|right) triceps brachii','triceps'),(r'(Left|Right) brachioradialis','brachiorad'),(r'(Left|Right) brachialis','brachialis'),
 (r'(Left|Right) (extensor carpi|extensor digit|extensor indicis|extensor pollicis|abductor pollicis longus)','forearm_ext'),(r'head of (left|right) extensor carpi ulnaris','forearm_ext'),
 (r'(Left|Right) (flexor carpi radialis|palmaris longus|flexor digitorum profundus|flexor pollicis longus)','forearm_flex'),(r'head of (left|right) (flexor carpi ulnaris|flexor digitorum superficialis)','forearm_flex'),
 (r'head of (left|right) pronator teres','pronator'),(r'(Left|Right) pronator quadratus','pronator'),(r'(Left|Right) supinator','supinator'),
 (r'(Left|Right) (iliocostalis|longissimus|spinalis)','erector'),(r'(Left|Right) multifidus','multifidus'),(r'(Left|Right) quadratus lumborum','ql'),
 (r'(Left|Right) rectus abdominis','rectus_abd'),(r'(Left|Right) external oblique','ext_oblique'),(r'(Left|Right) internal oblique','int_oblique'),
 (r'^Diaphragm$','diaphragm'),(r'(Left|Right) (psoas major|iliacus)','iliopsoas'),
 (r'(Left|Right) gluteus maximus','glute_max'),(r'(Left|Right) gluteus medius','glute_med'),(r'(Left|Right) gluteus minimus','glute_min'),(r'(Left|Right) piriformis','piriformis'),
 (r'(Left|Right) (gemellus|obturator internus|obturator externus|quadratus femoris)','deep_rot'),
 (r'(Left|Right) (adductor brevis|adductor longus|adductor magnus|adductor minimus|pectineus|gracilis)','adductors'),(r'(Left|Right) sartorius','sartorius'),
 (r'(Left|Right) rectus femoris','rectus_fem'),(r'(Left|Right) vastus lateralis','vastus_lat'),(r'(Left|Right) vastus medialis','vastus_med'),(r'(Left|Right) vastus intermedius','vastus_int'),
 (r'head of (left|right) biceps femoris','hamstrings'),(r'(Left|Right) (semitendinosus|semimembranosus)','hamstrings'),
 (r'head of (left|right) gastrocnemius','gastroc'),(r'(Left|Right) calcaneal tendon','gastroc'),(r'(Left|Right) plantaris','gastroc'),(r'(Left|Right) soleus','soleus'),
 (r'(Left|Right) popliteus','popliteus'),(r'(Left|Right) tibialis anterior','tib_ant'),(r'(Left|Right) fibularis','peroneus'),(r'(Left|Right) tibialis posterior','tib_post'),
 (r'(Left|Right) (flexor digitorum brevis|abductor hallucis|flexor accessorius)','plantar'),(r'(left|right) foot', None),
]
def muscle_group(name):
    for pat,g in MUSCLE_MAP:
        m=re.search(pat,name)
        if m:
            if g is None: return None,None
            side = 'L' if re.search(r'\bleft\b',name,re.I) else 'R' if re.search(r'\bright\b',name,re.I) else 'M'
            return g,side
    return None,None

BONE_PATTERNS = [r'vertebra$',r'^Atlas$',r'^Axis$',r'^Sacrum$',r'hip bone',r'femur',r'tibia$',r'fibula',r'patella',r'humerus',r'radius',r'ulna$',r'scapula',r'clavicle',
 r'rib$',r'costal cartilage',r'^Manubrium$',r'^Body of sternum$',r'^Xiphoid',r'(Frontal|Occipital|Sphenoid|Ethmoid)( bone)?$',r'parietal bone',r'temporal bone',r'maxilla$',r'zygomatic bone',r'^Mandible$',r'nasal bone',
 r'calcaneus',r'talus',r'cuboid',r'cuneiform',r'Navicular bone',r'metatarsal',r'metacarpal',r'phalanx',r'(capitate|hamate|lunate|scaphoid|pisiform|triquetral|trapezium|trapezoid)$',r'Intervertebral disk',r'^Hyoid']
def is_bone(name):
    return any(re.search(p,name,re.I) for p in BONE_PATTERNS)
